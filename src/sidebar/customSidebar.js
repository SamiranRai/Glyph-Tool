const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const {
  scanAllFilesContainKeywords,
  setSidebarCallback,
} = require("../features/fileScanner");

// Importing "highlightTimeStamps"
const { highlightTimeStamps } = require("./../features/highlightWord"); // store all keyword timeStamp
const { saveTimestamp } = require("./../db/levelDb");

const {
  loadKeywords,
  updateKeyword,
  addKeyword,
  removeKeyword,
} = require("./../utility/highlight_word_required/keywordManager");

function isFileUnchanged(filePath, prevMtime) {
  const currentMtime = fs.statSync(filePath).mtimeMs;
  return prevMtime === currentMtime;
}

class CustomSidebarProvider {
  constructor(context) {
    this.context = context;
    this.webviewView = null; // Store the webview instance
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView; // Store for later updates

    webviewView.webview.options = { enableScripts: true };

    const htmlPath = path.join(
      this.context.extensionPath,
      "src/sidebar/public/sidebar.html"
    );
    const cssURI = webviewView.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.context.extensionPath, "src/sidebar/public/sidebar.css")
      )
    );
    const jsURI = webviewView.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.context.extensionPath, "src/sidebar/public/sidebar.js")
      )
    );

    const generateColorUri = webviewView.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.context.extensionPath, "src/shared/colorGenerator.js")
      )
    );

    // 🔹 Convert the icons folder path into a webview-safe URI
    const iconsBaseUri = webviewView.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.context.extensionPath, "src/sidebar/public/icons")
      )
    );

    let htmlContent = fs.readFileSync(htmlPath, "utf-8");
    htmlContent = htmlContent
      .replace("{{styleUri}}", cssURI)
      .replace("{{scriptUri}}", jsURI)
      .replace("{{iconsBaseUri}}", iconsBaseUri)
      .replace("{{generateColorUri}}", generateColorUri); // Pass icons URI to HTML;

    webviewView.webview.html = htmlContent;

    // Listen for message from Sidebar (when requesting fresh data)
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "fetchData":
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "loadKeywords":
          this.sendSidebarUpdate(await loadKeywords());
          break;

        case "updateKeyword":
          await updateKeyword(message.keyword, message.newColor);
          this.sendSidebarUpdate(await loadKeywords());
          break;

        case "tabSwitched":
          await updateKeyword(message.keyword, message.newColor);
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "addKeyword":
          await addKeyword(message.keyword, message.color);
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "removeKeyword":
          console.log("Message received:", message.keyword);
          await removeKeyword(message.keyword); // Await here
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "toggleMark":
          console.log("Debug:ToggleMark: Case called!");

          // 1. Get timestamp before reading the file
          const mtimeBefore = fs.statSync(message.fullPath).mtimeMs;

          // 2. Read file content
          const fileContent = fs
            .readFileSync(message.fullPath, "utf-8")
            .split("\n");

          if (message.line < 0 || message.line >= fileContent.length) {
            console.warn("Invalid line number:", message.line);
            break;
          }

          // 3. Apply line update based on action
          let updatedLine;
          if (message.action === "done") {
            const timestamp = new Date();
            const options = { day: "2-digit", month: "short", year: "numeric" };
            const formattedTimestamp = timestamp.toLocaleDateString(
              "en-GB",
              options
            );
            updatedLine = `// DONE: "${message.keyword}" - ${message.comment} "${formattedTimestamp}"`;
          } else if (message.action === "undo") {
            updatedLine = `// ${message.keyword}: ${message.comment}`;
          } else {
            console.warn("Unknown action type:", message.action);
            break;
          }

          // 4. Update the target line
          fileContent[message.line - 1] = updatedLine;

          // 5. Check if file has changed since our read
          const mtimeAfterRead = fs.statSync(message.fullPath).mtimeMs;
          if (mtimeBefore !== mtimeAfterRead) {
            console.warn(
              "File modified externally during toggleMark. Aborting write."
            );
            break;
          }

          // 6. Proceed to write safely
          fs.writeFileSync(message.fullPath, fileContent.join("\n"));
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "vscode.open":
          const { fullPath, line } = message;
          // Open the file and jump to the exact line
          vscode.window.showTextDocument(vscode.Uri.file(fullPath), {
            selection: new vscode.Range(
              new vscode.Position(line - 1, 0),
              new vscode.Position(line - 1, 0)
            ),
          });
          break;
        default:
          console.warn("⚠️ Unknown command received:", message.command);
      }
    });

    setSidebarCallback((updateData) => {
      this.sendSidebarUpdate(updateData);
    });
  }

  sendSidebarUpdate(data) {
    if (this.webviewView && this.webviewView.webview) {
      this.webviewView.webview.postMessage({ command: "updateData", data });
    } else {
      console.warn("⚠️ Sidebar webview is unavailable. Could not send update.");
    }
  }
}

module.exports = CustomSidebarProvider;
