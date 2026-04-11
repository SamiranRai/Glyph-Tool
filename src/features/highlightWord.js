const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const getKeywordHighlightColor = require("../utility/highlight_word_required/getKeywordHighlightColor");
const commentStyles = require("../utility/file_scanner_required/commentStyles");
const { initDB, saveTimestamp, highlightTimeStamps } = require("./../db/levelDb");
const { generateKeywordKey } = require("./../utility/db_required/keyGenerator");

let predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");

// Guard flag to prevent concurrent highlight runs triggered by our own edits.
let isEditing = false;

// Cache of VS Code TextEditorDecorationType objects, keyed by uppercase keyword.
let decorationTypes = new Map();

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * Escapes all special regex characters in a string so it can be used as a
 * literal pattern inside a RegExp.
 * @param {string} source
 * @returns {string}
 */
function escapeRegex(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex that matches keyword annotations of the form:
 *   <commentPrefix> @KEYWORD: <rest of line>
 *
 * @param {string} commentPrefix  The language-specific comment symbol (e.g. "//", "#").
 * @returns {RegExp}
 */
function buildKeywordRegex(commentPrefix) {
  const escapedPrefix = escapeRegex(commentPrefix);
  return new RegExp(
    `^[ \\t]*${escapedPrefix}[ \\t]*@([a-zA-Z_][a-zA-Z0-9_]*)[:][^\\n]*$`,
    "gm",
  );
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

/**
 * Returns the comment symbol for the language of the given document, or
 * `null` if the language is unsupported.
 * @param {vscode.TextDocument} document
 * @returns {string|null}
 */
function getCommentSymbol(document) {
  const ext = path.extname(document.fileName).slice(1).toLowerCase();
  return commentStyles[ext] || null;
}

// ---------------------------------------------------------------------------
// Predefined keyword helpers
// ---------------------------------------------------------------------------

/**
 * Looks up a keyword in the current predefined color list.
 * @param {string} keyword  Uppercase keyword with trailing colon (e.g. "TODO:").
 * @returns {{ keyword: string, color: string } | undefined}
 */
function findPredefinedKeyword(keyword) {
  return predefinedKeywordColors.find((item) => item.keyword === keyword);
}

/**
 * Returns the background color hex string for a given keyword, using the
 * predefined list if available and falling back to the dynamic color generator.
 * @param {string} keyword
 * @returns {string}
 */
function getBackgroundColorForKeyword(keyword) {
  const predefined = findPredefinedKeyword(keyword);
  return predefined ? predefined.color : getKeywordHighlightColor(keyword).backgroundColor;
}

// ---------------------------------------------------------------------------
// Decoration management
// ---------------------------------------------------------------------------

/**
 * Returns (and lazily creates) a VS Code TextEditorDecorationType for the
 * given keyword.
 * @param {string} keyword
 * @returns {vscode.TextEditorDecorationType}
 */
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

/**
 * Clears all keyword decorations from the currently active text editor.
 */
function clearAllDecorationsInActiveEditor() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  decorationTypes.forEach((decoration) => {
    editor.setDecorations(decoration, []);
  });
}

/**
 * Applies the given keyword → ranges map to the editor as text decorations.
 * Any previously applied decorations are cleared first.
 * @param {vscode.TextEditor} editor
 * @param {Map<string, vscode.Range[]>} keywordRanges
 */
function applyDecorations(editor, keywordRanges) {
  clearAllDecorationsInActiveEditor();
  keywordRanges.forEach((ranges, keyword) => {
    const decoration = decorationTypes.get(keyword);
    if (decoration) {
      editor.setDecorations(decoration, ranges);
    }
  });
}

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

/**
 * Replaces the keyword text in the document with its uppercase form if needed.
 * This ensures keywords are always stored and displayed in a canonical format.
 * @param {vscode.TextEditor} editor
 * @param {vscode.Position} startPos
 * @param {vscode.Position} endPos
 * @param {string} keyword       Original keyword as found in the source.
 * @param {string} upperKeyword  Uppercase version of the keyword.
 */
async function normalizeKeywordInDocument(editor, startPos, endPos, keyword, upperKeyword) {
  if (keyword === upperKeyword) {
    return;
  }
  await editor.edit((editBuilder) => {
    editBuilder.replace(new vscode.Range(startPos, endPos), upperKeyword);
  });
}

// ---------------------------------------------------------------------------
// Hot-reload: watch preDefinedKeywords.js for user edits
// ---------------------------------------------------------------------------

const keywordsFilePath = path.join(
  __dirname,
  "../utility/highlight_word_required/preDefinedKeywords.js",
);

fs.watchFile(keywordsFilePath, () => {
  delete require.cache[
    require.resolve("../utility/highlight_word_required/preDefinedKeywords")
  ];
  predefinedKeywordColors = require("../utility/highlight_word_required/preDefinedKeywords");

  // Predefined colors changed — clear the decoration cache and re-highlight.
  clearAllDecorationsInActiveEditor();
  decorationTypes.clear();
  void highlightWords();
});

// ---------------------------------------------------------------------------
// Core feature
// ---------------------------------------------------------------------------

/**
 * Scans the active editor for keyword annotations, normalizes them to
 * uppercase, persists timestamps for newly-discovered keywords, and applies
 * colored background decorations.
 *
 * Re-entrant calls are safely dropped via the `isEditing` guard.
 * @param {vscode.ExtensionContext} [context]  Extension context used for timestamp persistence.
 */
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

      await normalizeKeywordInDocument(editor, startPos, endPos, keyword, upperKeyword);

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

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * Activates the highlight-word feature by initializing the database and
 * registering document/editor change listeners.
 * @param {vscode.ExtensionContext} context
 */
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
