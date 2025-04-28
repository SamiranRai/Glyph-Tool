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

        // toggle_mark_fix: fix the toggle mark not working for done and undo.
        case "toggleMark":
          console.log("Debug: toggleMark: Case called!");

          try {
            const uri = vscode.Uri.file(message.fullPath);

            console.log("Message content: ", message);

            let updatedLineText = "";
            const timestamp = new Date();
            const options = { day: "2-digit", month: "short", year: "numeric" };
            const formattedTimestamp = timestamp.toLocaleDateString(
              "en-GB",
              options
            );
            const milliseconds = timestamp.getTime();

            let isDeleteAction = false;

            // Determine action
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

            console.log("Updated line content: ", updatedLineText);

            let document;
            try {
              document = await vscode.workspace.openTextDocument(uri);
            } catch (err) {
              console.error(
                "🚨 Failed to open document, falling back to file system.",
                err
              );
            }

            if (document) {
              // File is open or can be opened normally
              const editor = await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: true,
              });

              const lineIndex = message.line - 1; // Adjusting for 1-based to 0-based line number
              if (lineIndex < 0 || lineIndex >= document.lineCount) {
                console.warn("❌ Invalid line number:", message.line);
                break;
              }

              const line = document.lineAt(lineIndex);

              await editor.edit((editBuilder) => {
                if (isDeleteAction) {
                  editBuilder.delete(line.rangeIncludingLineBreak);
                  console.log("Deleted line: ", line.text);
                } else {
                  editBuilder.replace(line.range, updatedLineText);
                  console.log("Replaced line: ", line.text);
                }
              });

              console.log("✅ Document edited successfully via editor.");
            } else {
              // Fallback: file is closed and cannot open in editor
              const fileBuffer = await vscode.workspace.fs.readFile(uri);
              const fileContent = Buffer.from(fileBuffer).toString("utf-8");
              console.log("File content before editing: ", fileContent);

              const lines = fileContent.split(/\r?\n/); // handle both LF and CRLF endings
              const lineIndex = message.line - 1;
              if (lineIndex < 0 || lineIndex >= lines.length) {
                console.warn(
                  "❌ Invalid line number in fallback mode:",
                  message.line
                );
                break;
              }

              const originalLineEnding = fileContent.includes("\r\n")
                ? "\r\n"
                : "\n";

              if (isDeleteAction) {
                console.log("Deleting line: ", lines[lineIndex]);
                lines.splice(lineIndex, 1);
              } else {
                console.log("Replacing line: ", lines[lineIndex]);
                lines[lineIndex] = updatedLineText;
              }

              const updatedContent = lines.join(originalLineEnding);
              const updatedBuffer = Buffer.from(updatedContent, "utf-8");
              await vscode.workspace.fs.writeFile(uri, updatedBuffer);
              console.log("✅ File system fallback write successful.");
            }

            // Update the sidebar UI
            try {
              const updatedSidebarData = await scanAllFilesContainKeywords();
              this.sendSidebarUpdate(updatedSidebarData);
            } catch (sidebarError) {
              console.error("🚨 Sidebar update error:", sidebarError);
            }
          } catch (err) {
            console.error("🚨 toggleMark general error:", err.stack || err);
          }
          break;

        // good but 97%
        // case "toggleMark":
        //   console.log("🔵 Debug: toggleMark case called");

        //   try {
        //     const uri = vscode.Uri.file(message.fullPath);
        //     const openDoc = vscode.workspace.textDocuments.find(
        //       (doc) =>
        //         normalizePath(doc.uri.fsPath) ===
        //         normalizePath(message.fullPath)
        //     );

        //     let updatedLine = "";
        //     const timestamp = new Date();
        //     const options = { day: "2-digit", month: "short", year: "numeric" };
        //     const formattedTimestamp = timestamp.toLocaleDateString(
        //       "en-GB",
        //       options
        //     );
        //     const milliseconds = timestamp.getTime();

        //     let isDeleteAction = false;

        //     if (message.action === "done") {
        //       updatedLine = `// DONE: "${message.keyword}" - ${message.comment} [${formattedTimestamp} | ${milliseconds}]`;
        //     } else if (message.action === "undo") {
        //       updatedLine = `// ${message.keyword}: ${message.comment}`;
        //     } else if (message.action === "disable") {
        //       updatedLine = `// ${message.keyword} : ${message.comment}`;
        //     } else if (message.action === "delete") {
        //       isDeleteAction = true;
        //     } else {
        //       console.warn("❌ Unknown toggleMark action:", message.action);
        //       break;
        //     }

        //     if (openDoc) {
        //       // File is open
        //       const editor = vscode.window.visibleTextEditors.find(
        //         (ed) =>
        //           normalizePath(ed.document.uri.fsPath) ===
        //           normalizePath(message.fullPath)
        //       );

        //       if (editor) {
        //         const tryEdit = async (retryCount = 0) => {
        //           const success = await editor.edit((editBuilder) => {
        //             const line = openDoc.lineAt(message.line - 1);
        //             if (isDeleteAction) {
        //               editBuilder.delete(line.rangeIncludingLineBreak);
        //             } else {
        //               editBuilder.replace(line.range, updatedLine);
        //             }
        //           });

        //           if (!success && retryCount < 2) {
        //             console.warn(
        //               `⚠️ Edit failed, retrying (${retryCount + 1})...`
        //             );
        //             await new Promise((resolve) => setTimeout(resolve, 100));
        //             await tryEdit(retryCount + 1);
        //           } else if (!success) {
        //             console.error("🚨 Editor edit failed even after retries.");
        //           }
        //         };

        //         await tryEdit();
        //       } else {
        //         console.warn("⚠️ Document open but editor not visible.");
        //       }
        //     } else {
        //       // File is not open - safe filesystem edit
        //       const fileBuffer = await vscode.workspace.fs.readFile(uri);
        //       let fileContent = fileBuffer.toString("utf8");

        //       // Strip BOM if present
        //       if (fileContent.charCodeAt(0) === 0xfeff) {
        //         fileContent = fileContent.slice(1);
        //       }

        //       // Detect line ending
        //       const lineEnding = fileContent.includes("\r\n") ? "\r\n" : "\n";

        //       const lines = fileContent.split(lineEnding);

        //       if (message.line <= 0 || message.line > lines.length) {
        //         console.warn("❌ Invalid line number:", message.line);
        //         break;
        //       }

        //       if (isDeleteAction) {
        //         lines.splice(message.line - 1, 1);
        //       } else {
        //         lines[message.line - 1] = updatedLine;
        //       }

        //       const finalContent = lines.join(lineEnding);

        //       // Retry system for writing
        //       const tryWrite = async (retryCount = 0) => {
        //         try {
        //           await vscode.workspace.fs.writeFile(
        //             uri,
        //             Buffer.from(finalContent, "utf8")
        //           );
        //         } catch (err) {
        //           if (retryCount < 2) {
        //             console.warn(
        //               `⚠️ Write failed, retrying (${retryCount + 1})...`
        //             );
        //             await new Promise((resolve) => setTimeout(resolve, 100));
        //             await tryWrite(retryCount + 1);
        //           } else {
        //             throw err;
        //           }
        //         }
        //       };

        //       await tryWrite();
        //     }

        //     // Refresh Sidebar
        //     this.sendSidebarUpdate(await scanAllFilesContainKeywords());
        //   } catch (err) {
        //     console.error("🚨 toggleMark error:", err);
        //   }

        //   break;

        // Latest Updated
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

        //     const milliseconds = timestamp.getTime(); // <-- getTime() gives milliseconds

        //     let isDeleteAction = false; // 👈 Track delete separately

        //     if (message.action === "done") {
        //       updatedLine = `// DONE: "${message.keyword}" - ${message.comment} [${formattedTimestamp} | ${milliseconds}]`;
        //     } else if (message.action === "undo") {
        //       updatedLine = `// ${message.keyword}: ${message.comment}`;
        //     } else if (message.action === "disable") {
        //       updatedLine = `// ${message.keyword} : ${message.comment}`;
        //     } else if (message.action === "delete") {
        //       isDeleteAction = true; // Mark delete action
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
        //           if (isDeleteAction) {
        //             editBuilder.delete(line.rangeIncludingLineBreak); // 💥 Remove entire line
        //           } else {
        //             editBuilder.replace(line.range, updatedLine);
        //           }
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

        //       if (isDeleteAction) {
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
