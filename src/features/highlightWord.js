const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const getKeywordHighlightColor = require("../utility/highlight_word_required/getKeywordHighlightColor");
let predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");
const commentStyles = require("../utility/file_scanner_required/commentStyles");

function getCommentSymbol(document) {
  const ext = path.extname(document.fileName).slice(1).toLowerCase();
  return commentStyles[ext] || null;
}
//------- WHOLE FILE BASED DYNAMIC REGULAR-EXPRESSION--------//

//------- WHOLE FILE BASED DYNAMIC REGULAR-EXPRESSION--------//

// Database related
const {
  initDB,
  saveTimestamp,
  deleteTimestamp,
  highlightTimeStamps,
} = require("./../db/levelDb");

let isEditing = false;
let decorationTypes = new Map();

// Watch for changes in preDefinedKeywords.js
const keywordsFilePath = path.join(
  __dirname,
  "../utility/highlight_word_required/preDefinedKeywords.js"
);
fs.watchFile(keywordsFilePath, (curr, prev) => {
  delete require.cache[
    require.resolve("../utility/highlight_word_required/preDefinedKeywords")
  ];
  predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");

  // Reset decorations
  decorationTypes.forEach((decoration) => {
    vscode.window.activeTextEditor?.setDecorations(decoration, []);
  });
  decorationTypes.clear(); // Clear all old decorations
  highlightWords(context); // Call to reassign color
});

async function highlightWords(context) {
  if (isEditing) return;
  isEditing = true;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    isEditing = false;
    return;
  }

  const text = editor.document.getText();
  // const regex = /^[ \t]*\/\/[ \t]*([a-zA-Z_][a-zA-Z0-9_]*):[^\n]*$/gm; -- 100% working
  //const regex = getHighlightRegex(); // testing -- 100% working
  const commentPrefix = getCommentSymbol(editor.document);
  if (!commentPrefix) return;

  const escapedPrefix = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(
    `^[ \\t]*${escapedPrefix}[ \\t]*@([a-zA-Z_][a-zA-Z0-9_]*)[:][^\\n]*$`,
    "gm"
  );
  let keywordRanges = new Map();
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

    // Safe DB call
    if (!highlightTimeStamps.has(uppercaseKeyword)) {
      await saveTimestamp(uppercaseKeyword, context);
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

    // Checking & applying predefined custom Keyword style, if present
    // console.log("predefinedKeywordColors:InsideHW.js", predefinedKeywordColors);

    let foundKeyword;
    for (const item of predefinedKeywordColors) {
      if (item.keyword === uppercaseKeyword) {
        foundKeyword = item;
        break;
      }
    }

    let bgColor;
    if (foundKeyword) {
      bgColor = foundKeyword.color;
    } else {
      bgColor = getKeywordHighlightColor(uppercaseKeyword).backgroundColor;
    }

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

  // // Remove timestamps for deleted keywords
  // for (const key of highlightTimeStamps.keys()) {
  //   if (!existingKeywords.has(key)) {
  //     await deleteTimestamp(key, context);
  //   }
  // }

  // Apply decorations (RESET before applying new ones)
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
  highlightWords,
  highlightTimeStamps,
};
