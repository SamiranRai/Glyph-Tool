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

// Helper
function normalizePath(path) {
  return path.replace(/\\/g, "/").toLowerCase();
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
          this.sendSidebarUpdate(await loadKeywords()); // changed
          break;

        case "updateKeyword":
          await updateKeyword(message.keyword, message.newColor);
          this.sendSidebarUpdate(await loadKeywords()); // changed
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
          this.sendSidebarUpdate(await removeKeyword());
          break;

        case "toggleMark":
          console.log("Debug: toggleMark: Case called!");

          try {
            const uri = vscode.Uri.file(message.fullPath);

            let updatedLineText = "";
            const timestamp = new Date();
            const options = { day: "2-digit", month: "short", year: "numeric" };
            const formattedTimestamp = timestamp.toLocaleDateString(
              "en-GB",
              options
            );
            const milliseconds = timestamp.getTime();

            let isDeleteAction = false;

            if (message.action === "done") {
              updatedLineText = `// DONE: "${message.keyword}" - ${message.comment} [${formattedTimestamp} | ${milliseconds}]`;
            } else if (message.action === "undo") {
              updatedLineText = `// ${message.keyword}: ${message.comment}`;
            } else if (message.action === "disable") {
              updatedLineText = `// ${message.keyword} : ${message.comment}`;
            } else if (message.action === "delete") {
              isDeleteAction = true;
            } else {
              console.warn("❌ Unknown toggleMark action:", message.action);
              break;
            }

            // Always re-read the file freshly
            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const decoder = new TextDecoder("utf-8");
            const textContent = decoder.decode(fileBytes);

            const normalizedText = textContent
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");
            const lines = normalizedText.split("\n");

            // 🔥 Find the correct line dynamically
            let targetLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (
                line.includes(message.keyword) &&
                line.includes(message.comment)
              ) {
                targetLineIndex = i;
                break;
              }
            }

            if (targetLineIndex === -1) {
              console.warn(
                "❌ Could not find matching line for:",
                message.keyword,
                message.comment
              );
              break;
            }

            if (isDeleteAction) {
              lines.splice(targetLineIndex, 1); // delete the line
            } else {
              lines[targetLineIndex] = updatedLineText; // replace the line
            }

            const originalNewline = textContent.includes("\r\n")
              ? "\r\n"
              : "\n";
            const encoder = new TextEncoder();
            const updatedContent = lines.join(originalNewline);
            const updatedBytes = encoder.encode(updatedContent);

            await vscode.workspace.fs.writeFile(uri, updatedBytes);

            // 🔄 Refresh sidebar
            this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          } catch (err) {
            console.error("🚨 toggleMark error:", err);
          }

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
