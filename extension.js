const vscode = require("vscode");

// Importing "highlightWords functions"
const { highlightWords } = require("./src/features/highlightWord");

// Importing "scanAllFilesContainKeywords" && "watchFiles"
const {
  scanAllFilesContainKeywords,
  watchFiles,
} = require("./src/features/fileScanner");

// Importing initDB
const {
  initDB,
  loadAllTimestampsToMemory,
  highlightTimeStamps,
  saveTimestamp,
} = require("./src/db/levelDb");

// Importing "CustomSidebarProvider"
const CustomSidebarProvider = require("./src/sidebar/customSidebar");

async function activate(context) {
  await initDB(context); // ✅ Load existing timestamps from globalState
  await loadAllTimestampsToMemory(context);
  const results = await scanAllFilesContainKeywords(context);
  for (const item of results) {
    const upperCaseKeyword = (item.keyword + ":").toUpperCase();
    if (!highlightTimeStamps.has(upperCaseKeyword)) {
      await saveTimestamp(upperCaseKeyword, context);
    }
  }
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

  // Start watching for file changes
  await watchFiles(context); // 🚀 This ensures real-time updates

  vscode.window.onDidChangeActiveTextEditor(() => highlightWords(context));
  vscode.workspace.onDidChangeTextDocument(() => highlightWords(context));
  await highlightWords(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
