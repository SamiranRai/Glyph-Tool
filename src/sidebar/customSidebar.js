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

        case "addKeyword":
          await addKeyword(message.keyword, message.color);
          this.sendSidebarUpdate(await loadKeywords());
          break;

        case "removeKeyword":
          console.log("Message received:", message.keyword);
          await removeKeyword(message.keyword); // Await here
          this.sendSidebarUpdate(await loadKeywords());
          break;

        // Backend: CustomSidebarProvider.js
        case "markAsDone":
          console.log("Debug:MarkAsDone: Case called!");

          // Read and update file content in one go
          const fileContent = fs
            .readFileSync(message.fullPath, "utf-8")
            .split("\n");
          if (message.line < 0 || message.line >= fileContent.length) {
            console.warn("Invalid line number:", message.line);
            break;
          }

          // Generate timestamp and apply change
          const timestamp = new Date().toISOString();
          const updatedLine = `// DONE: "${message.keyword}" - ${message.comment}. "${timestamp}"`;
          fileContent[message.line] = updatedLine;

          // Write updated content and send sidebar update
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
