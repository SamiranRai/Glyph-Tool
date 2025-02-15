const vscode = require("vscode");
const getKeywordHighlightColor = require("../utility/highlight_word_required/getKeywordHighlightColor");
const predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");
const handleSpacebarConversion = require("../utility/highlight_word_required/handleSpacebarConversion");

let isEditing = false;
let decorationTypes = new Map();
let highlightTimeStamps = new Map(); // Store timestamp for each keyword instance

async function highlightWords() {
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

  let match;
  while ((match = regex.exec(text))) {
    let keyword = match[1] + ":";
    const uppercaseKeyword = keyword.toUpperCase();

    const wordStartIndex = match.index + match[0].indexOf(match[1]);
    const wordEndIndex = wordStartIndex + keyword.length;
    const startPos = editor.document.positionAt(wordStartIndex);
    const endPos = editor.document.positionAt(wordEndIndex);

    // If the keyword does not exist or has changed, assign a new timestamp
    if (!highlightTimeStamps.has(uppercaseKeyword)) {
      highlightTimeStamps.set(uppercaseKeyword, Date.now());
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

    let bgColor =
      predefinedKeywordColors.get(uppercaseKeyword) ||
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
function activate(context) {
  const disposableTextChange = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (vscode.window.activeTextEditor?.document === event.document) {
        highlightWords();
      }
    }
  );

  const disposableEditorChange = vscode.window.onDidChangeActiveTextEditor(
    () => {
      highlightWords();
    }
  );

  const disposableKeyPress = vscode.commands.registerTextEditorCommand(
    "extension.replaceSpaceWithUnderscore",
    handleSpacebarConversion
  );

  context.subscriptions.push(
    disposableTextChange,
    disposableEditorChange,
    disposableKeyPress
  );
}

module.exports = {
  activate,
  highlightWords,
  handleSpacebarConversion,
  highlightTimeStamps, // Export timestamp Map
};
