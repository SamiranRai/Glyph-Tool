const vscode = require("vscode");

// Importing "highlightWords functions"
const { highlightWords } = require("./src/features/highlightWord");

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
  await initDB(context); // ✅ Load existing timestamps from globalState
  const results = await scanAllFilesContainKeywords(context);
  await highlightWords(context); // ✅ Now use safely without resetting others

  // Registering Highlight Word Command
  let highlightWordCommand = vscode.commands.registerCommand(
    "highlightWord.afterColon",
    async () => await highlightWords(context)
  );

  // Register File Scanner Command
  let scanHighlightedKeywordFiles = vscode.commands.registerCommand(
    "scanAllfiles.containDefaultKeyword",
    async () => await scanAllFilesContainKeywords(context)
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

  // Start watching for file changes, reusing the already-computed scan results
  // to avoid a redundant full workspace scan at startup.
  await watchFiles(context, results); // 🚀 This ensures real-time updates

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => highlightWords(context))
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => highlightWords(context))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
