const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const getKeywordHighlightColor = require("../../shared/get-keyword-highlight-color");
let predefinedKeywordColors = require("../../shared/predefined-keywords");
// Build a Map for O(1) keyword lookups instead of a linear array scan per match.
let predefinedKeywordMap = new Map(predefinedKeywordColors.map((item) => [item.keyword, item.color]));
const commentStyles = require("../../shared/comment-styles");
const { getCommentSymbolForFile } = require("../../shared/comment-utils");
const { createHighlightKeywordRegex } = require("../../shared/keyword-comment-regex");

function getCommentSymbol(document) {
  return getCommentSymbolForFile(document.fileName, commentStyles, null);
}

const {
  initDB,
  saveTimestamp,
  highlightTimeStamps,
} = require("../../db/levelDb");

const { generateKeywordKey } = require("../../shared/key-generator");

let isEditing = false;
let decorationTypes = new Map();

// Watch for changes in preDefinedKeywords.js
const keywordsFilePath = path.join(
  __dirname,
  "../../shared/predefined-keywords.js"
);
fs.watchFile(keywordsFilePath, () => {
  delete require.cache[
    require.resolve("../../shared/predefined-keywords")
  ];
  predefinedKeywordColors = require("../../shared/predefined-keywords");
  predefinedKeywordMap = new Map(predefinedKeywordColors.map((item) => [item.keyword, item.color]));

  // Reset decorations
  decorationTypes.forEach((decoration) => {
    vscode.window.activeTextEditor?.setDecorations(decoration, []);
  });
  decorationTypes.clear(); // Clear all old decorations
  highlightWords(); // Call to reassign color
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
  const commentPrefix = getCommentSymbol(editor.document);
  if (!commentPrefix) return;

  const regex = createHighlightKeywordRegex(commentPrefix);
  let keywordRanges = new Map();

  let match;
  while ((match = regex.exec(text))) {
    let keyword = match[1] + ":";
    const uppercaseKeyword = keyword.toUpperCase();

    const wordStartIndex = match.index + match[0].indexOf(match[1]);
    const wordEndIndex = wordStartIndex + keyword.length;
    const startPos = editor.document.positionAt(wordStartIndex);
    const endPos = editor.document.positionAt(wordEndIndex);

    const fileName = editor.document.fileName;
    const line = startPos.line;

    const uniqueKey = generateKeywordKey(uppercaseKeyword, fileName, line);

    if (!highlightTimeStamps.has(uniqueKey)) {
      await saveTimestamp(uppercaseKeyword, fileName, line, context);
    }

    if (keyword !== uppercaseKeyword) {
      await editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(startPos, endPos),
          uppercaseKeyword
        );
      });
    }

    let bgColor;
    if (predefinedKeywordMap.has(uppercaseKeyword)) {
      bgColor = predefinedKeywordMap.get(uppercaseKeyword);
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
