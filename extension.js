const vscode = require("vscode");

// Importing "highlightWords functions" && "handleSpacebarConversion"
const {
  highlightWords,
  handleSpacebarConversion,
} = require("./src/features/highlightWord");

// Importing "scanAllFilesContainKeywords" && "watchFiles"
const {
  scanAllFilesContainKeywords,
  watchFiles,
} = require("./src/features/fileScanner");

// Importing "CustomSidebarProvider"
const CustomSidebarProvider = require("./src/sidebar/customSidebar");

function activate(context) {
  // Registering Highlight Word Command
  let highlightWordCommand = vscode.commands.registerCommand(
    "highlightWord.afterColon",
    highlightWords
  );

  // Register File Scanner Command
  let scanHighlightedKeywordFiles = vscode.commands.registerCommand(
    "scanAllfiles.containDefaultKeyword",
    scanAllFilesContainKeywords
  );

  // Registering Spacebar Auto-Replace Command
  let spacebarCommand = vscode.commands.registerTextEditorCommand(
    "extension.replaceSpaceWithUnderscore",
    handleSpacebarConversion
  );

  // Registering Custom SideBar
  let customSidebar = vscode.window.registerWebviewViewProvider(
    "customSidebar",
    new CustomSidebarProvider(context)
  );
  // Push commands to subscriptions
  context.subscriptions.push(highlightWordCommand);
  context.subscriptions.push(scanHighlightedKeywordFiles);
  context.subscriptions.push(spacebarCommand);
  context.subscriptions.push(customSidebar);

  // Start watching for file changes
  watchFiles(); // 🚀 This ensures real-time updates

  // Apply highlight automatically
  vscode.window.onDidChangeActiveTextEditor(highlightWords);
  vscode.workspace.onDidChangeTextDocument(highlightWords);
  highlightWords();
}

function deactivate() {}

module.exports = { activate, deactivate };
