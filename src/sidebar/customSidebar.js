//------ ACT AS MIDDLE MAN FOR FRONTEND <-(CUSTOMSIDEBAR.JS)-> BACKEND
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// Importing "scanAllFilesContainKeywords"
const { scanAllFilesContainKeywords } = require("../features/fileScanner");

// Custom Sidebar:
class CustomSidebarProvider {
  constructor(context) {
    this.context = context;
  }

  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    };

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

    let htmlContent = fs.readFileSync(htmlPath, "utf-8");
    htmlContent = htmlContent
      .replace("{{styleUri}}", cssURI)
      .replace("{{scriptUri}}", jsURI);

    webviewView.webview.html = htmlContent;

    // Listen for message from the sidebar
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "fetchData") {
        // Sidebar send a request "fetchData"
        const data = await scanAllFilesContainKeywords();
        // Send the response "updateData" to the Sidebar
        webviewView.webview.postMessage({ command: "updateData", data });
      }
    });
  }
}

module.exports = CustomSidebarProvider;
