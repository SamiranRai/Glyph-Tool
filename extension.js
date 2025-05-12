const vscode = require("vscode");

// Importing "highlightWords functions"
const {
  highlightWords,
  highlightTimeStamps,
} = require("./src/features/highlightWord");

// Importing "scanAllFilesContainKeywords" && "watchFiles"
const {
  scanAllFilesContainKeywords,
  watchFiles,
} = require("./src/features/fileScanner");

// Importing initDB
const { initDB } = require("./src/db/levelDb");

// Importing "CustomSidebarProvider"
const CustomSidebarProvider = require("./src/sidebar/customSidebar");

async function activate(context) {
  await initDB(context, highlightTimeStamps); // Init initDB() ->first

  // Highlight words when the extension is activated
  highlightWords(context);

  // Registering Highlight Word Command
  let highlightWordCommand = vscode.commands.registerCommand(
    "highlightWord.afterColon",
    async () => await highlightWords(context)
  );

  // Register File Scanner Command
  let scanHighlightedKeywordFiles = vscode.commands.registerCommand(
    "scanAllfiles.containDefaultKeyword",
    scanAllFilesContainKeywords
  );

  // Registering Custom SideBar
  let customSidebar = vscode.window.registerWebviewViewProvider(
    "customSidebar",
    new CustomSidebarProvider(context)
  );
  // Push commands to subscriptions
  context.subscriptions.push(highlightWordCommand);
  context.subscriptions.push(scanHighlightedKeywordFiles);
  context.subscriptions.push(customSidebar);

  // Start watching for file changes
  watchFiles(); // 🚀 This ensures real-time updates

  // Apply highlight automatically
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      highlightWords(context);
    }
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    highlightWords(context);
  });

  // Wait for the first file to open if there’s no active editor yet
  if (vscode.window.activeTextEditor) {
    await highlightWords(context);
  } else {
    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        console.log("First file detected: Applying highlight.");
        highlightWords(context);
        disposable.dispose();
      }
    });
  }

  // vscode.window.onDidChangeActiveTextEditor(highlightWords);
  // vscode.workspace.onDidChangeTextDocument(highlightWords);
  // await highlightWords(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
