const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { getCommentSymbolForFile } = require("../../shared/comment-utils");
const { createScanKeywordRegex } = require("../../shared/keyword-comment-regex");

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

function isExcluded(fileUri) {
  return EXCLUDED_DIRS.some((dir) =>
    fileUri.fsPath.split(/[\\/]/).includes(dir)
  );
}

let cachedPreDefinedKeywords = require("../../shared/predefined-keywords");
const preDefinedKeywordsFilePath = require.resolve("../../shared/predefined-keywords");
fs.watchFile(preDefinedKeywordsFilePath, () => {
  try {
    delete require.cache[preDefinedKeywordsFilePath];
    cachedPreDefinedKeywords = require(preDefinedKeywordsFilePath);
  } catch (err) {
    console.error("Failed to reload predefined keywords file:", err);
  }
});

const fileExtensions = require("../../shared/file-extensions");
const commentStyles = require("../../shared/comment-styles");
const {
  saveTimestamp,
  highlightTimeStamps
} = require("../../db/levelDb");

const { generateKeywordKey } = require("../../shared/key-generator");

const regexCache = new Map();

function buildRegexForExt(ext) {
  if (regexCache.has(ext)) {
    return regexCache.get(ext);
  }
  const commentSymbol = commentStyles[ext] || "//";
  const regex = createScanKeywordRegex(commentSymbol);
  regexCache.set(ext, regex);
  return regex;
}

const resultData = [];
let updateSidebar = null;

const scanAllFilesContainKeywords = async (context) => {
  resultData.length = 0; // Clear previous results

  const workspaceFolder = vscode.workspace.workspaceFolders;
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage("No workspace opened!");
  }

  const files = await vscode.workspace.findFiles(
    `**/*.{${fileExtensions.join(",")}}`
  );

  resultData.push({ preDefinedKeywords: cachedPreDefinedKeywords });

  for (const file of files) {
    try {
      if (isExcluded(file)) continue;

      const ext = path.extname(file.fsPath).replace(".", "").toLowerCase();

      const regex = buildRegexForExt(ext);
      regex.lastIndex = 0;
      let content;
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === file.fsPath
      );

      if (openEditor) {
        content = openEditor.document.getText();
      } else {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(file)
        ).toString("utf8");
      }

      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = regex.exec(lines[i]))) {
          const descriptionMatch = match.input.match(/:\s*(.*)/);
          const description =
            descriptionMatch && descriptionMatch[1]
              ? descriptionMatch[1].trim()
              : "No Description.";

          let keyword = match[1] + ":";
          let fileName = path.basename(file.fsPath);
          let line = i + 1;
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
    console.error("updateSidebar is not set. Sidebar cannot update.");
  }

  return resultData;
};

let previousComments = new Map();
let initialScanCompleted = false;
let debouncerTimer = null;
let recentlyUpdated = false;

const watchFiles = async (context, initialResults = null) => {
  const scanResults = initialResults !== null
    ? initialResults
    : await scanAllFilesContainKeywords(context);
  void scanResults;
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

  watcher.onDidCreate(() => {
    scanAllFilesContainKeywords(context);
  });

  watcher.onDidDelete(() => {
    scanAllFilesContainKeywords(context);
  });

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (!initialScanCompleted) return;

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;
    const fileName = activeEditor?.document.fileName || "unknown";
    const lines = activeEditor?.document.getText()?.split("\n") || [];

    const ext = path
      .extname(event.document.fileName)
      .replace(".", "")
      .toLowerCase();

    const commentSymbol = getCommentSymbolForFile(event.document.fileName, commentStyles, "//");
    const regex = regexCache.get(ext) || createScanKeywordRegex(commentSymbol);
    regexCache.set(ext, regex);

    const text = event.document.getText();
    const matches = new Map();

    for (const match of text.matchAll(regex)) {
      const keyword = match[1].trim();
      const description = match[2]?.trim() || "No Description";
      matches.set(`${keyword}: ${description}`, true);
    }

    if (!previousComments.size) {
      matches.forEach((_, comment) => previousComments.set(comment, true));
      return;
    }

    const newComments = [...matches.keys()];
    const oldComments = [...previousComments.keys()];

    const removedComments = oldComments.filter(
      (comment) => !matches.has(comment)
    );
    const addedComments = newComments.filter(
      (comment) => !previousComments.has(comment)
    );

    if (removedComments.length > 0 || addedComments.length > 0) {
      for (const comment of addedComments) {
        const keyword = comment.split(":")[0];
        const lineIndex = lines.findIndex(line =>
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
};

const setSidebarCallback = (callback) => {
  updateSidebar = callback;
};

module.exports = {
  scanAllFilesContainKeywords,
  watchFiles,
  setSidebarCallback,
};
