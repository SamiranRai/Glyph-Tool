const vscode = require("vscode");
const path = require("path");

const preDefinedKeywordsPath = "./../utility/highlight_word_required/preDefinedKeywords";
const fileExtensions = require("../utility/file_scanner_required/fileExtensions");
const commentStyles = require("../utility/file_scanner_required/commentStyles");
const {
  saveTimestamp,
  highlightTimeStamps,
} = require("./../db/levelDb");
const { generateKeywordKey } = require("./../utility/db_required/keyGenerator");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Directory names that are never scanned for keyword annotations. */
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".vercel",
  ".cache",
  "coverage",
  "tmp",
  "temp",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the given file URI is inside one of the excluded
 * directories.
 * @param {import('vscode').Uri} fileUri
 * @returns {boolean}
 */
function isExcluded(fileUri) {
  return EXCLUDED_DIRS.some((dir) =>
    fileUri.fsPath.split(/[\\/]/).includes(dir)
  );
}

/**
 * Escapes special regex characters in a string so it can be used as a literal
 * pattern inside a RegExp.
 * @param {string} symbol
 * @returns {string}
 */
function escapeRegex(symbol) {
  return symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Builds the keyword-annotation regex for the given comment symbol.
 * Matches lines of the form: `<commentSymbol> @KEYWORD: description`
 * @param {string} commentSymbol
 * @returns {RegExp}
 */
function buildCommentRegex(commentSymbol) {
  const escaped = escapeRegex(commentSymbol);
  return new RegExp(
    `^\\s*${escaped}\\s*@([A-Z_]+):\\s*(.*)`,
    "gm"
  );
}

/**
 * Re-requires `preDefinedKeywords.js` bypassing the module cache, so that
 * user edits to the file are picked up without restarting the extension.
 * @returns {Array<{ keyword: string, color: string }>}
 */
function loadPredefinedKeywords() {
  const filePath = require.resolve(preDefinedKeywordsPath);
  delete require.cache[filePath];
  return require(filePath);
}

// ---------------------------------------------------------------------------
// Sidebar update callback
// ---------------------------------------------------------------------------

/** Callback registered by the sidebar provider to receive fresh scan results. */
let updateSidebar = null;

/**
 * Registers the function that the sidebar provider uses to update its UI.
 * Must be called once from the sidebar provider's `resolveWebviewView`.
 * @param {(data: object[]) => void} callback
 */
const setSidebarCallback = (callback) => {
  updateSidebar = callback;
};

// ---------------------------------------------------------------------------
// Core scanner
// ---------------------------------------------------------------------------

/** Holds the latest scan results shared across the module. */
const resultData = [];

/**
 * Scans every file in the workspace for keyword annotations, persists any
 * newly-discovered timestamps, and pushes the full result set to the sidebar.
 *
 * @param {import('vscode').ExtensionContext} context
 * @returns {Promise<object[]>}  The collected keyword items.
 */
const scanAllFilesContainKeywords = async (context) => {
  resultData.length = 0;

  const workspaceFolder = vscode.workspace.workspaceFolders;
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage("No workspace opened!");
  }

  const files = await vscode.workspace.findFiles(
    `**/*.{${fileExtensions.join(",")}}`
  );

  // Include predefined keywords so the sidebar can render color swatches.
  resultData.push({ preDefinedKeywords: loadPredefinedKeywords() });

  for (const file of files) {
    try {
      if (isExcluded(file)) continue;

      const ext = path.extname(file.fsPath).replace(".", "").toLowerCase();
      const commentSymbol = commentStyles[ext] || "//";
      const regex = buildCommentRegex(commentSymbol);

      // Prefer real-time editor content over the on-disk version.
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === file.fsPath
      );
      const content = openEditor
        ? openEditor.document.getText()
        : Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8");

      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = regex.exec(lines[i]))) {
          const descriptionMatch = match.input.match(/:\s*(.*)/);
          const description =
            descriptionMatch && descriptionMatch[1]
              ? descriptionMatch[1].trim()
              : "No Description.";

          const keyword = match[1] + ":";
          const fileName = path.basename(file.fsPath);
          const line = i + 1;
          const uniqueKey = generateKeywordKey(keyword, fileName, line);

          if (!highlightTimeStamps.has(uniqueKey)) {
            await saveTimestamp(keyword, fileName, line, context);
          }
          const existingTimestamp = highlightTimeStamps.get(uniqueKey);

          resultData.push({
            keyword: match[1],
            description,
            file: path.basename(file.fsPath),
            fullPath: file.fsPath,
            line: i + 1,
            timeStamp: existingTimestamp,
            snippet: lines[i].trim(),
          });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading file: ${file.fsPath}`);
      console.error(`Error reading file ${file.fsPath}:`, error);
    }
  }

  if (updateSidebar) {
    updateSidebar(resultData);
  } else {
    console.error("updateSidebar is not set — sidebar cannot update.");
  }

  return resultData;
};

// ---------------------------------------------------------------------------
// Real-time file watcher
// ---------------------------------------------------------------------------

// State used by the change-detection logic in onDidChangeTextDocument.
let previousComments = new Map();
let initialScanCompleted = false;
let debouncerTimer = null;
let recentlyUpdated = false;

/**
 * Runs an initial workspace scan and then starts watching for file-system and
 * in-editor changes so the sidebar always reflects the current state.
 * @param {import('vscode').ExtensionContext} context
 */
const watchFiles = async (context) => {
  const initialResults = await scanAllFilesContainKeywords(context);
  initialScanCompleted = true;

  const watcher = vscode.workspace.createFileSystemWatcher(
    `**/*.{${fileExtensions.join(",")}}`
  );

  watcher.onDidChange(() => {
    if (recentlyUpdated) {
      recentlyUpdated = false;
      return;
    }
    scanAllFilesContainKeywords(context);
  });

  watcher.onDidCreate(() => scanAllFilesContainKeywords(context));
  watcher.onDidDelete(() => scanAllFilesContainKeywords(context));

  // Detect real-time text changes (even before saving).
  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (!initialScanCompleted) return;

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;

    const fileName = activeEditor.document.fileName;
    const lines = activeEditor.document.getText().split("\n");

    const ext = path
      .extname(event.document.fileName)
      .replace(".", "")
      .toLowerCase();
    const commentSymbol = commentStyles[ext] || "//";
    const regex = buildCommentRegex(commentSymbol);

    const text = event.document.getText();
    const matches = new Map();

    for (const match of text.matchAll(regex)) {
      const keyword = match[1].trim();
      const description = match[2]?.trim() || "No Description";
      matches.set(`${keyword}: ${description}`, true);
    }

    // Populate previousComments once after the initial scan.
    if (!previousComments.size) {
      matches.forEach((_, comment) => previousComments.set(comment, true));
      return;
    }

    const newComments = [...matches.keys()];
    const oldComments = [...previousComments.keys()];

    const removedComments = oldComments.filter((c) => !matches.has(c));
    const addedComments = newComments.filter((c) => !previousComments.has(c));

    if (removedComments.length > 0 || addedComments.length > 0) {
      for (const comment of addedComments) {
        const keyword = comment.split(":")[0];
        const lineIndex = lines.findIndex((line) =>
          line.includes("@" + keyword.replace(":", ""))
        );
        const line = lineIndex !== -1 ? lineIndex : 0;
        await saveTimestamp(keyword + ":", fileName, line, context);
      }

      previousComments.clear();
      newComments.forEach((comment) => previousComments.set(comment, true));

      if (debouncerTimer) clearTimeout(debouncerTimer);
      debouncerTimer = setTimeout(() => {
        scanAllFilesContainKeywords(context);
        recentlyUpdated = true;
      }, 500);
    }
  });

  return initialResults;
};

module.exports = {
  scanAllFilesContainKeywords,
  watchFiles,
  setSidebarCallback,
};
