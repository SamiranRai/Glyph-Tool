const vscode = require("vscode");
const path = require("path");

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

// Check if a file is inside any excluded directory
function isExcluded(fileUri) {
  return EXCLUDED_DIRS.some((dir) =>
    fileUri.fsPath.split(/[\\/]/).includes(dir)
  );
}

// Importing "preDefinedKeywords"
const preDefinedKeywords = () => {
  const filePath = require.resolve(
    "./../utility/highlight_word_required/preDefinedKeywords"
  );
  delete require.cache[filePath]; // Clear cache
  return require(filePath); // Re-require updated file
};

// Importing "fileExtensions"
const fileExtensions = require("../utility/file_scanner_required/fileExtensions");
const commentStyles = require("../utility/file_scanner_required/commentStyles");
// Importing "highlightTimeStamps"
//const { highlightTimeStamps } = require("./highlightWord"); // store all keyword timeStamp
const {
  saveTimestamp,
  getTimestamp,
  getAllTimestamps,
  highlightTimeStamps
} = require("./../db/levelDb");

const { generateKeywordKey } = require("./../utility/db_required/keyGenerator");

// Store the data
const resultData = [];
let updateSidebar = null; // Store the sidebar update function

const scanAllFilesContainKeywords = async (context) => {
  resultData.length = 0; // Clear previous results

  const workspaceFolder = vscode.workspace.workspaceFolders;
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage("No workspace opened!");
  }

  const files = await vscode.workspace.findFiles(
    `**/*.{${fileExtensions.join(",")}}`
  );

  // Push the preDefinedKeywords once outside the loop
  resultData.push({ preDefinedKeywords: preDefinedKeywords() });

  for (const file of files) {
    try {
      if (isExcluded(file)) continue; // ⛔ Skip excluded folders

      const ext = path.extname(file.fsPath).replace(".", "").toLowerCase();
      const commentSymbol = commentStyles[ext] || "//";

      let regex;

      const escapeRegex = (symbol) =>
        symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

      if (commentSymbol === ";") {
        // Match ; KEY: description (for AHK, INI)
        regex = new RegExp(
          `^\\s*${escapeRegex(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
          "gm"
        );
      } else if (commentSymbol === "#") {
        // Match # KEY: description (for Python, Bash, etc.)
        regex = new RegExp(`^\\s*#\\s*@([A-Z_]+):\\s*(.*)`, "gm");
      } else {
        // default : line comments like //, --
        regex = new RegExp(
          `^\\s*${escapeRegex(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
          "gm"
        );
      }

      let content;
      // 📝 First, check if the file is open in an editor
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === file.fsPath
      );

      // if it's open
      if (openEditor) {
        content = openEditor.document.getText(); // Get real-time content
        //console.log("RealTimeContent:", content);
      } else {
        // 📂 If not open, read from disk
        // content = Buffer.from(
        //   await vscode.workspace.fs.readFile(file)
        // ).toString("utf8");

        content = Buffer.from(
          await vscode.workspace.fs.readFile(file)
        ).toString("utf8"); // 🟢 Read from disk
        //console.log("WholeDisk Content:", content)
      }
      //resultData.push({ preDefinedKeywords });

      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = regex.exec(lines[i]))) {
          const descriptionMatch = match.input.match(/:\s*(.*)/);
          const description =
            descriptionMatch && descriptionMatch[1]
              ? descriptionMatch[1].trim()
              : "No Description.";

          let keyword = match[1] + ":"; // return  - keyword
          let fileName = path.basename(file.fsPath);
          let line = i + 1;
          const uniqueKey = generateKeywordKey(keyword, fileName, line);
          //let existingTimestamp = getTimestamp(uniqueKey);

          if (!highlightTimeStamps.has(uniqueKey)) {
            await saveTimestamp(keyword, fileName, line, context);
          }
          const existingTimestamp = highlightTimeStamps.get(uniqueKey); // update reference

          // Push the date to "resultData" array
          resultData.push({
            keyword: match[1],
            description,
            file: path.basename(file.fsPath),
            fullPath: file.fsPath,
            line: i + 1,
            timeStamp: existingTimestamp,
            snippet: lines[i].trim(),
            // predefinedkeywords : preDefinedKeywords,
          });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading file: ${file.fsPath}`);
      console.error(`Error reading file ${file.fsPath}:`, error);
    }
  }

  console.log("Updated resultData:", resultData);

  if (updateSidebar) {
    updateSidebar(resultData);
  } else {
    console.error("❌ updateSidebar is NOT set! Sidebar cannot update.");
  }

  // also returning "resultData" for watchFiles--> previous keyword init scanning
  return resultData;
};

//Store previously detected keywords to avoid unnecessary scans
let previousComments = new Map(); // Stores keyword-description pairs
let previousKeywords = new Set();
let initialScanCompleted = false;
let debouncerTimer = null;
let recentlyUpdated = false;

// watchFile-> for real-time file monitoring
const watchFiles = async (context) => {
  // Run an initial scan and store existing keywords in previousKeywords
  const initialResults = await scanAllFilesContainKeywords(context);
  previousKeywords = new Set(initialResults.map((item) => item.keyword));
  initialScanCompleted = true; // Intial Scan Completed!

  const watcher = vscode.workspace.createFileSystemWatcher(
    `**/*.{${fileExtensions.join(",")}}`
  );

  watcher.onDidChange(() => {
    if (recentlyUpdated) {
      // console.log("Skipping redundant scan (already updated by text edit)");
      recentlyUpdated = false;
      return;
    }
    // console.log("File Changed - Rescanning...");
    scanAllFilesContainKeywords(context);
  });

  watcher.onDidCreate(() => {
    // console.log("File Created - Rescanning...");
    scanAllFilesContainKeywords(context);
  });

  watcher.onDidDelete(() => {
    // console.log("File Deleted - Rescanning...");
    scanAllFilesContainKeywords(context);
  });

  // Detect real-time text changes (even before saving)

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (!initialScanCompleted) return; // Skip scanning before initial load

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;
    const fileName = activeEditor?.document.fileName || "unknown";
    const lines = activeEditor?.document.getText()?.split("\n") || [];

    const ext = path
      .extname(event.document.fileName)
      .replace(".", "")
      .toLowerCase();
    const commentSymbol = commentStyles[ext] || "//";

    const escapeRegex = (symbol) =>
      symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

    if (commentSymbol === ";") {
      // Match ; KEY: description (for AHK, INI)
      regex = new RegExp(
        `^\\s*${escapeRegex(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
        "gm"
      );
    } else if (commentSymbol === "#") {
      // Match # KEY: description (for Python, Bash, etc.)
      regex = new RegExp(`^\\s*#\\s*@([A-Z_]+):\\s*(.*)`, "gm");
    } else {
      // default : line comments like //, --
      regex = new RegExp(
        `^\\s*${escapeRegex(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
        "gm"
      );
    }

    const text = event.document.getText();
    const matches = new Map();

    // keyword : Description`
    //const regex = /^\/\/\s*([A-Z_]+):\s*(.*)$/gm;
    for (const match of text.matchAll(regex)) {
      const keyword = match[1].trim();
      const description = match[2]?.trim() || "No Description";
      matches.set(`${keyword}: ${description}`, true); // Store full pair
    }

    // Populate `previousComments` only once after the initial scan
    if (!previousComments.size) {
      matches.forEach((_, comment) => previousComments.set(comment, true));
      return;
    }

    // Detect added and removed comments
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
        // => save()
        await saveTimestamp(keyword + ":", fileName, line, context);
      }

      previousComments.clear();
      newComments.forEach((comment) => previousComments.set(comment, true));

      if (debouncerTimer) clearTimeout(debouncerTimer);
      debouncerTimer = setTimeout(() => {
        scanAllFilesContainKeywords(context);
        recentlyUpdated = true;
      }, 500);
    } else {
      console.log(
        "✅ No meaningful comment changes detected, skipping rescan."
      );
    }
  });
};

// Modify `setSidebarCallback`
const setSidebarCallback = (callback) => {
  updateSidebar = callback;
};

module.exports = {
  scanAllFilesContainKeywords,
  watchFiles,
  setSidebarCallback,
};
