const vscode = require("vscode");
const path = require("path");

// Importing "preDefinedKeywords"
const preDefinedKeywords = require("./../utility/highlight_word_required/preDefinedKeywords");
// Importing "fileExtensions"
const fileExtensions = require("../utility/file_scanner_required/fileExtensions");
// Importing "highlightTimeStamps"
const { highlightTimeStamps } = require("./highlightWord"); // store all keyword timeStamp
const { saveTimestamp } = require("./../db/levelDb");

// Store the data
const resultData = [];
let updateSidebar = null; // Store the sidebar update function

const scanAllFilesContainKeywords = async () => {
  resultData.length = 0; // Clear previous results

  const workspaceFolder = vscode.workspace.workspaceFolders;
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage("No workspace opened!");
  }

  const files = await vscode.workspace.findFiles(
    `**/*.{${fileExtensions.join(",")}}`
  );

  // Regular expression to match the "keyword present" files
  const regex = /\/\/\s*\b([A-Z_]+):/gm;

  // Push the preDefinedKeywords once outside the loop
  resultData.push({ preDefinedKeywords });

  for (const file of files) {
    try {
      let content;

      // 📝 First, check if the file is open in an editor
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === file.fsPath
      );

      // if it's open
      if (openEditor) {
        content = openEditor.document.getText(); // Get real-time content
      } else {
        // 📂 If not open, read from disk
        content = Buffer.from(
          await vscode.workspace.fs.readFile(file)
        ).toString("utf8");
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

          // Push the date to "resultData" array
          resultData.push({
            keyword: match[1],
            description,
            file: path.basename(file.fsPath),
            fullPath: file.fsPath,
            line: i + 1,
            timeStamp:
              highlightTimeStamps.get(match[1] + ":") || "NO-TIME_STAMP",
            snippet: lines[i].trim(),
            //preDefinedKeywords: preDefinedKeywords,
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
const watchFiles = async () => {
  console.log("Intial Scan Running!");

  // Run an initial scan and store existing keywords in previousKeywords
  const initialResults = await scanAllFilesContainKeywords();
  previousKeywords = new Set(initialResults.map((item) => item.keyword));
  initialScanCompleted = true; // Intial Scan Completed!

  const watcher = vscode.workspace.createFileSystemWatcher(
    `**/*.{${fileExtensions.join(",")}}`
  );

  watcher.onDidChange(() => {
    if (recentlyUpdated) {
      console.log("Skipping redundant scan (already updated by text edit)");
      recentlyUpdated = false;
      return;
    }
    console.log("File Changed - Rescanning...");
    scanAllFilesContainKeywords();
  });

  watcher.onDidCreate(() => {
    console.log("File Created - Rescanning...");
    scanAllFilesContainKeywords();
  });

  watcher.onDidDelete(() => {
    console.log("File Deleted - Rescanning...");
    scanAllFilesContainKeywords();
  });

  // Detect real-time text changes (even before saving)

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (!initialScanCompleted) return; // Skip scanning before initial load

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;

    const text = event.document.getText();
    const matches = new Map();

    // Regex to match `// KEYWORD: Description`
    const regex = /^\/\/\s*([A-Z_]+):\s*(.*)$/gm;
    for (const match of text.matchAll(regex)) {
      const keyword = match[1].trim();
      const description = match[2]?.trim() || "No Description";
      matches.set(`${keyword}: ${description}`, true); // Store full pair
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
      console.log("🔄 Changes detected in comments. Rescanning...");

      for (const comment of addedComments) {
        const keyword = comment.split(":")[0];
        const newTimestamp = new Date().toISOString();
        highlightTimeStamps.set(keyword + ":", newTimestamp);
        await saveTimestamp(keyword + ":", highlightTimeStamps);
      }

      previousComments.clear();
      newComments.forEach((comment) => previousComments.set(comment, true));

      if (debouncerTimer) clearTimeout(debouncerTimer);
      debouncerTimer = setTimeout(() => {
        scanAllFilesContainKeywords();
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
