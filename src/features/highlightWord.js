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

function escapeRegex(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywordRegex(commentPrefix) {
  const escapedPrefix = escapeRegex(commentPrefix);
  return new RegExp(
    `^[ \\t]*${escapedPrefix}[ \\t]*@([a-zA-Z_][a-zA-Z0-9_]*)[:][^\\n]*$`,
    "gm",
  );
}

function findPredefinedKeyword(keyword) {
  return predefinedKeywordColors.find((item) => item.keyword === keyword);
}

function getBackgroundColorForKeyword(keyword) {
  const predefined = findPredefinedKeyword(keyword);
  if (predefined) {
    return predefined.color;
  }
  return getKeywordHighlightColor(keyword).backgroundColor;
}

function getOrCreateDecorationType(keyword) {
  if (!decorationTypes.has(keyword)) {
    decorationTypes.set(
      keyword,
      vscode.window.createTextEditorDecorationType({
        backgroundColor: getBackgroundColorForKeyword(keyword),
        color: "white",
        fontWeight: "bold",
      }),
    );
  }

  return decorationTypes.get(keyword);
}

function clearAllDecorationsInActiveEditor() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  decorationTypes.forEach((decoration) => {
    editor.setDecorations(decoration, []);
  });
}

function applyDecorations(editor, keywordRanges) {
  clearAllDecorationsInActiveEditor();

  keywordRanges.forEach((ranges, keyword) => {
    const decoration = decorationTypes.get(keyword);
    if (decoration) {
      editor.setDecorations(decoration, ranges);
    }
  });
}

async function normalizeKeywordInDocument(
  editor,
  startPos,
  endPos,
  keyword,
  upperKeyword,
) {
  if (keyword === upperKeyword) {
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.replace(new vscode.Range(startPos, endPos), upperKeyword);
  });
}

// Database related
const {
  initDB,
  saveTimestamp,
  highlightTimeStamps,
} = require("./../db/levelDb");

const { generateKeywordKey } = require("./../utility/db_required/keyGenerator");

let isEditing = false;
let decorationTypes = new Map();

// Watch for changes in preDefinedKeywords.js
const keywordsFilePath = path.join(
  __dirname,
  "../utility/highlight_word_required/preDefinedKeywords.js",
);
fs.watchFile(keywordsFilePath, (curr, prev) => {
  void curr;
  void prev;

  delete require.cache[
    require.resolve("../utility/highlight_word_required/preDefinedKeywords")
  ];
  predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");

  // Predefined colors changed. Clear and rebuild decoration types on next run.
  clearAllDecorationsInActiveEditor();
  decorationTypes.clear(); // Clear all old decorations
  void highlightWords(); // Call to reassign color
};);

async function highlightWords(context) {
  if (isEditing) return;
  isEditing = true;

  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const commentPrefix = getCommentSymbol(editor.document);
    if (!commentPrefix) {
      return;
    }

    const text = editor.document.getText();
    const regex = buildKeywordRegex(commentPrefix);
    const keywordRanges = new Map();

    let match;
    while ((match = regex.exec(text))) {
      const keyword = `${match[1]}:`;
      const upperKeyword = keyword.toUpperCase();

      const wordStartIndex = match.index + match[0].indexOf(match[1]);
      const wordEndIndex = wordStartIndex + keyword.length;
      const startPos = editor.document.positionAt(wordStartIndex);
      const endPos = editor.document.positionAt(wordEndIndex);

      const fileName = editor.document.fileName;
      const line = startPos.line;
      const uniqueKey = generateKeywordKey(upperKeyword, fileName, line);

      // Keep DB state and text normalization in sync with each matched keyword.
      if (!highlightTimeStamps.has(uniqueKey)) {
        await saveTimestamp(upperKeyword, fileName, line, context);
      }

      await normalizeKeywordInDocument(
        editor,
        startPos,
        endPos,
        keyword,
        upperKeyword,
      );

      getOrCreateDecorationType(upperKeyword);

      if (!keywordRanges.has(upperKeyword)) {
        keywordRanges.set(upperKeyword, []);
      }

      keywordRanges.get(upperKeyword).push(new vscode.Range(startPos, endPos));
    }

    applyDecorations(editor, keywordRanges);
  } finally {
    isEditing = false;
  }
}

// **Activation Function**
async function activate(context) {
  await initDB(context);

  const disposableTextChange = vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      if (vscode.window.activeTextEditor?.document === event.document) {
        await highlightWords(context);
      }
    },
  );

  const disposableEditorChange = vscode.window.onDidChangeActiveTextEditor(
    async () => {
      await highlightWords(context);
    },
  );

  context.subscriptions.push(disposableTextChange, disposableEditorChange);
}

module.exports = {
  activate,
  highlightWords,
  highlightTimeStamps,
};

