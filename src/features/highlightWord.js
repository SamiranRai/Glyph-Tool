const vscode = require("vscode");
const { Level } = require("level");
const getKeywordHighlightColor = require("../utility/highlight_word_required/getKeywordHighlightColor");
const predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");

let isEditing = false;
let decorationTypes = new Map();
let highlightTimeStamps = new Map(); // Store timestamp for each keyword instance
let db; // level instance

// ✅ Ensure DB is initialized before use
async function initDB(context) {
  try {
    const storagePath = context.globalStorageUri.fsPath;
    db = new Level(`${storagePath}/timestamps-db`, { valueEncoding: "json" });
    await loadTimestampsFromDB(); // Load timestamps after DB initializes
  } catch (error) {
    console.error("❌ Failed to initialize LevelDB:", error);
  }
}

// ✅ Safe save to DB
async function saveTimestamp(keyword) {
  if (!db) {
    console.error("❌ LevelDB is not initialized. Cannot save:", db);
    return;
  }

  const currentTime = Date.now();

  try {
    // Check If value exist and it's same
    const existingTime = highlightTimeStamps.get(keyword);
    if (existingTime && existingTime === currentTime) return;

    await db.put(keyword, currentTime);
    highlightTimeStamps.set(keyword, currentTime);
  } catch (error) {
    console.error(`❌ Error saving timestamp for ${keyword}:`, error);
  }
}

// ✅ Safe delete from DB
async function deleteTimestamp(keyword) {
  if (!db) return;
  try {
    await db.del(keyword);
    highlightTimeStamps.delete(keyword);
  } catch (error) {
    console.error(`❌ Failed to delete ${keyword}:`, error);
  }
}

// ✅ Ensure DB is initialized before loading
async function loadTimestampsFromDB() {
  try {
    // Clear the loacl cache before populate with data
    highlightTimeStamps.clear();

    for await (const [key, value] of db.iterator()) {
      // Updating the local Cache with latest data.
      highlightTimeStamps.set(key.toString(), value.toString());
    }

    console.log(
      "highlightTimeStamps:::" + JSON.stringify([...highlightTimeStamps])
    );
  } catch (error) {
    console.error("Error laoding... data from LevelDB", { error });
  }
}

async function highlightWords(context) {
  if (isEditing) return;
  isEditing = true;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    isEditing = false;
    return;
  }

  const text = editor.document.getText();
  const regex = /\/\/[^\n]*\b(\w+):/gm;
  let keywordRanges = new Map();
  let keywordDetails = [];
  let existingKeywords = new Set(); // For Keyword Tracking purpose

  let match;
  while ((match = regex.exec(text))) {
    let keyword = match[1] + ":";
    const uppercaseKeyword = keyword.toUpperCase();

    const wordStartIndex = match.index + match[0].indexOf(match[1]);
    const wordEndIndex = wordStartIndex + keyword.length;
    const startPos = editor.document.positionAt(wordStartIndex);
    const endPos = editor.document.positionAt(wordEndIndex);

    existingKeywords.add(uppercaseKeyword); // Track Seen Keyword

    // ✅ Safe DB call
    if (!highlightTimeStamps.has(uppercaseKeyword)) {
      await saveTimestamp(uppercaseKeyword);
    }

    // Ensure keyword is converted to uppercase in the document
    if (keyword !== uppercaseKeyword) {
      await editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(startPos, endPos),
          uppercaseKeyword
        );
      });
    }

    // Checking & applying predefined custom Keyword style, if presents
    const foundKeyword = predefinedKeywordColors.find(
      (item) => item.keyword === uppercaseKeyword
    );

    let bgColor =
      foundKeyword?.color ||
      getKeywordHighlightColor(uppercaseKeyword).backgroundColor;

    if (!decorationTypes.has(uppercaseKeyword)) {
      decorationTypes.set(
        uppercaseKeyword,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: bgColor,
          color: "white",
          fontWeight: "bold",
        })
      );
    }

    if (!keywordRanges.has(uppercaseKeyword)) {
      keywordRanges.set(uppercaseKeyword, []);
    }
    keywordRanges
      .get(uppercaseKeyword)
      .push(new vscode.Range(startPos, endPos));
  }

  // ✅ Remove timestamps for deleted keywords
  for (const key of highlightTimeStamps.keys()) {
    if (!existingKeywords.has(key)) {
      await deleteTimestamp(key);
    }
  }

  // Apply decorations
  decorationTypes.forEach((decoration) => {
    editor.setDecorations(decoration, []);
  });

  keywordRanges.forEach((ranges, keyword) => {
    const decoration = decorationTypes.get(keyword);
    if (decoration) {
      editor.setDecorations(decoration, ranges);
    }
  });

  isEditing = false;
}

// **Activation Function**
async function activate(context) {
  await initDB(context);

  const disposableTextChange = vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      if (vscode.window.activeTextEditor?.document === event.document) {
        await highlightWords(context);
      }
    }
  );

  const disposableEditorChange = vscode.window.onDidChangeActiveTextEditor(
    async () => {
      await highlightWords(context);
    }
  );

  context.subscriptions.push(disposableTextChange, disposableEditorChange);
}

module.exports = {
  activate,
  initDB,
  highlightWords,
  highlightTimeStamps,
};
