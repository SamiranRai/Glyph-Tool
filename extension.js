const vscode = require("vscode");

const { highlightWords } = require("./src/features/highlightWord");
const { scanAllFilesContainKeywords, watchFiles } = require("./src/features/fileScanner");
const {
  initDB,
  loadAllTimestampsToMemory,
  highlightTimeStamps,
  saveTimestamp,
} = require("./src/db/levelDb");
const { generateKeywordKey } = require("./src/utility/db_required/keyGenerator");
const CustomSidebarProvider = require("./src/sidebar/customSidebar");

/**
 * Called by VS Code when the extension is activated.
 * Initialises the database, runs the first workspace scan, registers all
 * commands and views, and starts the real-time file watcher.
 * @param {import('vscode').ExtensionContext} context
 */
async function activate(context) {
  // Load persisted timestamps before any scan so existing entries are not duplicated.
  await initDB(context);
  await loadAllTimestampsToMemory(context);

  const results = await scanAllFilesContainKeywords(context);
  for (const item of results) {
    const upperCaseKeyword = (item.keyword + ":").toUpperCase();
    const fileName = item.file || "unknown";
    const line = item.line ?? 0;
    const uniqueKey = generateKeywordKey(upperCaseKeyword, fileName, line);

    if (!highlightTimeStamps.has(uniqueKey)) {
      await saveTimestamp(upperCaseKeyword, fileName, line, context);
    }
  }

  await highlightWords(context);

  // Commands
  const highlightWordCommand = vscode.commands.registerCommand(
    "highlightWord.afterColon",
    async () => await highlightWords(context)
  );

  const scanHighlightedKeywordFiles = vscode.commands.registerCommand(
    "scanAllfiles.containDefaultKeyword",
    async () => await scanAllFilesContainKeywords(context)
  );

  // Sidebar
  const customSidebar = vscode.window.registerWebviewViewProvider(
    "customSidebar",
    new CustomSidebarProvider(context)
  );

  context.subscriptions.push(
    highlightWordCommand,
    scanHighlightedKeywordFiles,
    customSidebar
  );

  // Start watching for file changes (also hooks into onDidChangeTextDocument).
  await watchFiles(context);

  vscode.window.onDidChangeActiveTextEditor(() => highlightWords(context));
  vscode.workspace.onDidChangeTextDocument(() => highlightWords(context));
  await highlightWords(context);
}

/** Called by VS Code when the extension is deactivated. */
function deactivate() {}

module.exports = { activate, deactivate };
