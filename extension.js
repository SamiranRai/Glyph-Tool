const vscode = require("vscode");

const {
  highlightWords,
} = require("./src/features/highlighting/highlight-word");

const {
  scanAllFilesContainKeywords,
  watchFiles,
} = require("./src/features/scanning/file-scanner");

const { initDB } = require("./src/db/levelDb");

const CustomSidebarProvider = require("./src/features/sidebar/custom-sidebar-provider");

async function activate(context) {
  await initDB(context);
  const results = await scanAllFilesContainKeywords(context);
  await highlightWords(context);

  let highlightWordCommand = vscode.commands.registerCommand(
    "highlightWord.afterColon",
    async () => await highlightWords(context)
  );

  let scanHighlightedKeywordFiles = vscode.commands.registerCommand(
    "scanAllfiles.containDefaultKeyword",
    async () => await scanAllFilesContainKeywords(context)
  );

  let customSidebar = vscode.window.registerWebviewViewProvider(
    "customSidebar",
    new CustomSidebarProvider(context),
  );
  context.subscriptions.push(highlightWordCommand);
  context.subscriptions.push(scanHighlightedKeywordFiles);
  context.subscriptions.push(customSidebar);

  await watchFiles(context, results);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => highlightWords(context))
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => highlightWords(context))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
