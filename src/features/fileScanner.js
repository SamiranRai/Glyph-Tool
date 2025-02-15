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
let initialTextScanCompleted = false; // New flag to prevent false removals on first edit

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

  console.log("📂 Watching for file changes...");

  // 📝 Detect real-time text changes (even before saving)
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (!initialScanCompleted) return; // ✅ Prevent unnecessary re-scans

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;

    console.log("📝 Text Changed - Checking for new keywords...");

    const text = event.document.getText();
    const regex = /\/\/[^\n]*\b(\w+):/g;
    const matches = [...text.matchAll(regex)].map((match) => match[1]);
    // matches: ["TODO", "NOTE", "DEBUG", "HACK", "INFO"] -> get all the keyword in the current file

    const removedKeywords = [...previousKeywords].filter(
      (keyword) => !matches.includes(keyword)
    );

    // previousKeywords = ["TODO", "NOTE"];
    // matches = ["TODO", "NOTE", "IMPORTANT"];

    // newKeywords = ["IMPORTANT"]; // ✅ Only detects the new keyword

    const newKeywords = matches.filter(
      (keyword) => !previousKeywords.has(keyword)
    );

    // 🚀 **Fix: Only process removed keywords after first real text edit**
    if (!initialTextScanCompleted) {
      initialTextScanCompleted = true; // First text change has occurred, now we allow removal detection
      console.log(
        "✅ First text scan complete, now tracking removals properly."
      );
      return; // Skip processing on the first edit
    }

    if (newKeywords.length > 0 || removedKeywords.length > 0) {
      console.log("🆕 New Keywords Detected:", newKeywords);
      console.log("❌ Removed Keywords Detected:", removedKeywords);

      // ✅ Sync previousKeywords with detected keywords
      previousKeywords.clear();
      matches.forEach((keyword) => previousKeywords.add(keyword));

      scanAllFilesContainKeywords(); // Run scan to update sidebar
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
