const vscode = require("vscode");
const path = require("path");

// Importing "fileExtensions"
const fileExtensions = require("../utility/file_scanner_required/fileExtensions");
// Importing "highlightTimeStamps"
const { highlightTimeStamps } = require("./highlightWord"); // store all keyword timeStamp

// Store the data
const resultData = [];
// Store previously detected keywords to avoid unnecessary scans
let previousKeywords = new Set();
let debounceTimer;

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
  const regex = /\/\/\s*\b([A-Z_]+):/gm;

  let detectedKeywords = new Set();

  for (const file of files) {
    try {
      let content;

      // 📝 First, check if the file is open in an editor
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === file.fsPath
      );

      if (openEditor) {
        content = openEditor.document.getText(); // Get real-time content
      } else {
        // 📂 If not open, read from disk
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

          resultData.push({
            keyword: match[1],
            description,
            file: path.basename(file.fsPath),
            fullPath: file.fsPath,
            line: i + 1,
            snippet: lines[i].trim(),
            timeStamp:
              highlightTimeStamps.get(match[1] + ":") || "NO-TIME_STAMP",
          });

          detectedKeywords.add(match[1]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading file: ${file.fsPath}`);
      console.error(`Error reading file ${file.fsPath}:`, error);
    }
  }

  //previousKeywords = detectedKeywords;
  //previousKeywords = new Set(detectedKeywords);

  console.log("🔍 Updated resultData:", resultData);

  // if (updateSidebar) {
  //   updateSidebar(resultData); // Ensure UI updates
  // }

  return resultData;
};

let initialScanCompleted = false;
let debouncerTime = null;
let recentlyUpdated = false;

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
    console.log("🔄 File Changed - Rescanning...");
    scanAllFilesContainKeywords();
  });

  watcher.onDidCreate(() => {
    console.log("➕ File Created - Rescanning...");
    scanAllFilesContainKeywords();
  });

  watcher.onDidDelete(() => {
    console.log("❌ File Deleted - Rescanning...");
    scanAllFilesContainKeywords();
  });

  //console.log("📂 Watching for file changes...");

  // 📝 Detect real-time text changes (even before saving)
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (!initialScanCompleted) return; // ✅ Prevent unnecessary re-scans

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;

    //console.log("📝 Text Changed - Checking for new keywords...");

    const text = event.document.getText();
    const regex = /\/\/[^\n]*\b(\w+):/g;
    const matches = [...text.matchAll(regex)].map((match) => match[1]);

    const removedKeywords = [...previousKeywords].filter(
      (keyword) => !matches.includes(keyword)
    );

    const newKeywords = matches.filter(
      (keyword) => !previousKeywords.has(keyword)
    );

    if (newKeywords.length > 0 || removedKeywords.length > 0) {
      // console.log("🆕 New Keywords Detected:", newKeywords);
      // console.log("❌ Removed Keywords Detected:", removedKeywords);
      // ✅ Sync previousKeywords with detected keywords
      previousKeywords.clear();
      matches.forEach((keyword) => previousKeywords.add(keyword));

      // Apply debounce mechanisim
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("🔄 Debounced Scan Triggered...");
        scanAllFilesContainKeywords();
        recentlyUpdated = true; // Scan was already done!
      }, 500);
    } else {
      console.log("✅ No real keyword changes detected, skipping rescan.");
    }
  });
};

// const setSidebarCallback = (callback) => {
//   updateSidebar = callback;
// };

module.exports = {
  scanAllFilesContainKeywords,
  watchFiles,
  //setSidebarCallback,
};
