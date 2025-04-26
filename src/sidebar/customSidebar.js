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
            const openDoc = vscode.workspace.textDocuments.find(
              (doc) => doc.uri.fsPath === message.fullPath
            );

            let updatedLine = "";
            const timestamp = new Date();
            const options = { day: "2-digit", month: "short", year: "numeric" };
            const formattedTimestamp = timestamp.toLocaleDateString(
              "en-GB",
              options
            );

            let isDeleteAction = false; // 👈 Track delete separately

            if (message.action === "done") {
              updatedLine = `// DONE: "${message.keyword}" - ${message.comment} "${formattedTimestamp}"`;
            } else if (message.action === "undo") {
              updatedLine = `// ${message.keyword}: ${message.comment}`;
            } else if (message.action === "disable") {
              updatedLine = `// ${message.keyword} : ${message.comment}`;
            } else if (message.action === "delete") {
              isDeleteAction = true; // Mark delete action
            } else {
              console.warn("❌ Unknown toggleMark action:", message.action);
              break;
            }

            if (openDoc) {
              // ✅ If file is open, edit using VS Code API
              const editor = vscode.window.visibleTextEditors.find(
                (ed) => ed.document.uri.fsPath === message.fullPath
              );

              if (editor) {
                await editor.edit((editBuilder) => {
                  const line = openDoc.lineAt(message.line - 1);
                  if (isDeleteAction) {
                    editBuilder.delete(line.rangeIncludingLineBreak); // 💥 Remove entire line
                  } else {
                    editBuilder.replace(line.range, updatedLine);
                  }
                });
              } else {
                console.warn("⚠️ Document is open but editor is not visible.");
              }
            } else {
              // ✅ If file is not open, edit directly via fs
              const fileBuffer = await vscode.workspace.fs.readFile(uri);
              const lines = fileBuffer.toString("utf-8").split("\n");

              if (message.line <= 0 || message.line > lines.length) {
                console.warn("❌ Invalid line number:", message.line);
                break;
              }

              if (isDeleteAction) {
                lines.splice(message.line - 1, 1); // 💥 Remove the line entirely
              } else {
                lines[message.line - 1] = updatedLine;
              }

              const updatedBuffer = Buffer.from(lines.join("\n"), "utf-8");
              await vscode.workspace.fs.writeFile(uri, updatedBuffer);
            }

            // 🔄 Update sidebar UI
            this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          } catch (err) {
            console.error("🚨 toggleMark error:", err);
          }

          break;

        // case "toggleMark":
        //   console.log("Debug: toggleMark: Case called!");

        //   try {
        //     const uri = vscode.Uri.file(message.fullPath);
        //     const openDoc = vscode.workspace.textDocuments.find(
        //       (doc) => doc.uri.fsPath === message.fullPath
        //     );

        //     let updatedLine = "";
        //     const timestamp = new Date();
        //     const options = { day: "2-digit", month: "short", year: "numeric" };
        //     const formattedTimestamp = timestamp.toLocaleDateString(
        //       "en-GB",
        //       options
        //     );

        //     // BY DEFAULT SET FALSE
        //     let deleteAction = false;
        //     let deleteAllAction = false;

        //     if (message.action === "done") {
        //       updatedLine = `// DONE: "${message.keyword}" - ${message.comment} "${formattedTimestamp}"`;
        //     } else if (message.action === "undo") {
        //       updatedLine = `// ${message.keyword}: ${message.comment}`;
        //     } else if (message.action === "disable") {
        //       updatedLine = `// ${message.keyword} : ${message.comment}`;
        //     } else if (message.action === "delete") {
        //       // SET TRUE
        //       deleteAction = true;
        //     } else if (message.action === "deleteAll") {
        //       // SET TRUE
        //       deleteAllAction = true;
        //     } else {
        //       console.warn("❌ Unknown toggleMark action:", message.action);
        //       break;
        //     }

        //     if (openDoc) {
        //       // ✅ If file is open, edit using VS Code API
        //       const editor = vscode.window.visibleTextEditors.find(
        //         (ed) => ed.document.uri.fsPath === message.fullPath
        //       );

        //       if (editor) {
        //         await editor.edit((editBuilder) => {
        //           const line = openDoc.lineAt(message.line - 1);
        //           editBuilder.replace(line.range, updatedLine);
        //         });
        //       } else {
        //         console.warn("⚠️ Document is open but editor is not visible.");
        //       }
        //     } else {
        //       // ✅ If file is not open, edit directly via fs
        //       const fileBuffer = await vscode.workspace.fs.readFile(uri);
        //       const lines = fileBuffer.toString("utf-8").split("\n");

        //       if (message.line <= 0 || message.line > lines.length) {
        //         console.warn("❌ Invalid line number:", message.line);
        //         break;
        //       }

        //       // check for delete action
        //       if (deleteAction) {
        //         lines.splice(message.line - 1, 1); // 💥 Remove the line entirely
        //       } else {
        //         lines[message.line - 1] = updatedLine;
        //       }

        //       const updatedBuffer = Buffer.from(lines.join("\n"), "utf-8");
        //       await vscode.workspace.fs.writeFile(uri, updatedBuffer);
        //     }

        //     // 🔄 Update sidebar UI
        //     this.sendSidebarUpdate(await scanAllFilesContainKeywords());
        //   } catch (err) {
        //     console.error("🚨 toggleMark error:", err);
        //   }

        //   break;

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
