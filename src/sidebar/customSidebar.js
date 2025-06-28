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

// <---------------------------------------------------------->

// Map of comment styles for different file extensions
const commentStyles = {
  js: "//", // JavaScript
  jsx: "//", // JavaScript (React)
  ts: "//", // TypeScript
  tsx: "//", // TypeScript (React)
  java: "//", // Java
  c: "//", // C
  cpp: "//", // C++
  cs: "//", // C#
  go: "//", // Go
  php: "//", // PHP (also supports '#')
  py: "#", // Python
  rb: "#", // Ruby
  rs: "//", // Rust
  swift: "//", // Swift
  kt: "//", // Kotlin
  dart: "//", // Dart
  scala: "//", // Scala
  scss: "//", // Sass (SCSS)
  less: "//", // Less
  ahk: ";", // AutoHotkey
  sh: "#", // Shell
  bash: "#", // Bash
  zsh: "#", // ZSH
  yaml: "#", // YAML
  yml: "#", // YAML
  toml: "#", // TOML
  ini: ";", // INI
  cfg: "#", // Config
  jsonc: "//", // JSON with comments
  css: "/*", // CSS (block comments)
  vue: "//", // Vue (inside <script>)
  svelte: "//", // Svelte (inside <script>)
  md: "<!--", // Markdown (HTML-style comments)
  html: "<!--", // HTML
  xml: "<!--", // XML
  sql: "--", // SQL
  pl: "#", // Perl
  pm: "#", // Perl Module
  r: "#", // R
  m: "%", // MATLAB
  jl: "#", // Julia
  lisp: ";", // Lisp
  clj: ";", // Clojure
  cljs: ";", // ClojureScript
  fs: "//", // F#
  fsi: "//", // F# Interactive
  ml: "(*", // OCaml
  mli: "(*", // OCaml Interface
  vb: "'", // Visual Basic
  vbs: "'", // VBScript
  ps1: "#", // PowerShell
  tex: "%", // LaTeX
  asm: ";", // Assembly
  bat: "REM", // Batch file
  dockerfile: "#", // Dockerfile
  makefile: "#", // Makefile
  groovy: "//", // Groovy
  gradle: "//", // Gradle
  h: "//", // C Header
  hpp: "//", // C++ Header
  objc: "//", // Objective-C
  objcpp: "//", // Objective-C++
  coffee: "#", // CoffeeScript
  styl: "//", // Stylus
  elm: "--", // Elm
  hs: "--", // Haskell
  erl: "%", // Erlang
  ex: "#", // Elixir
  exs: "#", // Elixir Script
  nim: "#", // Nim
  cr: "#", // Crystal
  v: "//", // Verilog
  sv: "//", // SystemVerilog
  vhdl: "--", // VHDL
  ada: "--", // Ada
  d: "//", // D
  pas: "//", // Pascal
  asm: ";", // Assembly
  s: ";", // Assembly
  rkt: ";", // Racket
  sc: "//", // Scala
  kt: "//", // Kotlin
  kts: "//", // Kotlin Script
  tsx: "//", // TypeScript JSX
  jsx: "//", // JavaScript JSX
  json5: "//", // JSON5
  toml: "#", // TOML
  cfg: "#", // Config
  conf: "#", // Config
  ini: ";", // INI
  properties: "#", // Java Properties
  dotenv: "#", // .env files
  env: "#", // Environment files
  tf: "#", // Terraform
  tfvars: "#", // Terraform variables
  hcl: "#", // HashiCorp Configuration Language
  puppet: "#", // Puppet
  chef: "#", // Chef
  ansible: "#", // Ansible
  salt: "#", // SaltStack
  jinja: "{#", // Jinja2
  twig: "{#", // Twig
  erb: "<%", // Embedded Ruby
  ejs: "<%", // Embedded JavaScript
  mustache: "{{!", // Mustache
  handlebars: "{{!", // Handlebars
  liquid: "{%", // Liquid
  njk: "{#", // Nunjucks
};

// Function to dynamically generate the correct comment
function getCommentStyleForFile(fileName) {
  const fileExtension = fileName.split(".").pop();
  return commentStyles[fileExtension] || "//"; // Default to "//" if no matching extension is found
}

// <---------------------------------------------------------->

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
          console.log("Keyword Added Successfully");
          this.sendSidebarUpdate(await scanAllFilesContainKeywords());
          break;

        case "removeKeyword":
          await removeKeyword(message.keyword); // Await here
          console.log("Keyword removed Successfully");
          this.sendSidebarUpdate(await scanAllFilesContainKeywords()); // changed from removeKeyword()
          break;

        case "toggleMark":
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

            // CURRENT FILE COMMENT SYMBOL
            const commentSymbol = getCommentStyleForFile(message.fileName);

            // Determine action
            const isMultiline = [
              "<!--",
              "/*",
              "(*",
              "{#",
              "<%",
              "{{!",
              "{%",
            ].includes(commentSymbol);

            // Multiline edning comment
            const commentEndMap = {
              "<!--": "-->",
              "/*": "*/",
              "(*": "*)",
              "{#": "#}",
              "<%": "%>",
              "{{!": "}}",
              "{%": "%}",
            };

            let isDeleteAction = false;

            // Determine action
            if (message.action === "done") {
              if (isMultiline) {
                const commentEnd = commentEndMap[commentSymbol];
                updatedLineText = `${commentSymbol} @DONE: "${message.keyword}" [${formattedTimestamp} | ${milliseconds}] ${commentEnd}`;
              } else {
                updatedLineText = `${commentSymbol} @DONE: "${message.keyword}" - ${message.comment} [${formattedTimestamp} | ${milliseconds}]`;
              }
              //updatedLineText = `${commentSymbol} DONE: "${message.keyword}" - ${message.comment} [${formattedTimestamp} | ${milliseconds}]`;
            } else if (message.action === "undo") {
              if (isMultiline) {
                const commentEnd = commentEndMap[commentSymbol];
                updatedLineText = `${commentSymbol} @${message.keyword}: ${message.comment} ${commentEnd}`;
              } else {
                updatedLineText = `${commentSymbol} @${message.keyword}: ${message.comment}`;
              }
              //updatedLineText = `${commentSymbol} ${message.keyword}: ${message.comment}`;
            } else if (message.action === "disable") {
              updatedLineText = `${commentSymbol} @${message.keyword} : ${message.comment}`;
            } else if (message.action === "delete") {
              isDeleteAction = true;
            } else {
              console.warn("❌ Unknown toggleMark action:", message.action);
              break;
            }

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
                } else {
                  editBuilder.replace(line.range, updatedLineText);
                }
              });
            } else {
              // fallback : file is closed and cannot open in editor
              const fileBuffer = await vscode.workspace.fs.readFile(uri);
              const fileContent = Buffer.from(fileBuffer).toString("utf-8");
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
                lines.splice(lineIndex, 1);
              } else {
                lines[lineIndex] = updatedLineText;
              }

              const updatedContent = lines.join(originalLineEnding);
              const updatedBuffer = Buffer.from(updatedContent, "utf-8");
              await vscode.workspace.fs.writeFile(uri, updatedBuffer);
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

        case "deleteAll":
          try {
            const confirmation = await vscode.window.showWarningMessage(
              "This will delete all DONE items from all your files. Are you sure you want to continue?",
              { modal: true },
              "Yes",
              "Cancel"
            );

            if (confirmation !== "Yes") {
              break;
            }

            // SCAN ALL KEYWORDS
            const allKeywordItems = await scanAllFilesContainKeywords();

            // FILTER ONLY DONE KEYWORD
            const doneItems = allKeywordItems.filter(
              (item) =>
                item.keyword === "DONE" &&
                item.fullPath &&
                typeof item.line === "number"
            );

            // CHECKING FOR DONE KEYWORD
            if (doneItems.length === 0) {
              vscode.window.showInformationMessage(
                "No DONE items found to delete."
              );
              break;
            }

            // Group items by file
            const groupedByFile = {};
            for (const item of doneItems) {
              if (!groupedByFile[item.fullPath])
                groupedByFile[item.fullPath] = [];
              groupedByFile[item.fullPath].push(item.line - 1); // Adjust to 0-based index
            }

            for (const [fullPath, lineIndices] of Object.entries(
              groupedByFile
            )) {
              try {
                const uri = vscode.Uri.file(fullPath);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document, {
                  preview: false,
                  preserveFocus: true,
                });

                const sortedLines = lineIndices.sort((a, b) => b - a); // Delete bottom-up

                await editor.edit((editBuilder) => {
                  for (const lineIndex of sortedLines) {
                    if (lineIndex >= 0 && lineIndex < document.lineCount) {
                      const line = document.lineAt(lineIndex);
                      editBuilder.delete(line.rangeIncludingLineBreak);
                    }
                  }
                });
              } catch (err) {
                console.error(`❌ Failed to process file: ${fullPath}`, err);
              }
            }

            vscode.window.showInformationMessage(
              `✅ Successfully deleted ${doneItems.length} DONE items across all files.`
            );

            // Refresh the sidebar UI
            try {
              const updatedSidebarData = await scanAllFilesContainKeywords();
              this.sendSidebarUpdate(updatedSidebarData); // Replace with your actual webview update method
            } catch (sidebarErr) {
              console.error("🚨 Sidebar update error:", sidebarErr);
            }
          } catch (err) {
            console.error("🚨 deleteAll general error:", err.stack || err);
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

        case "requestUpdateData":
          try {
            const updatedSidebarData = await scanAllFilesContainKeywords();
            this.sendSidebarUpdate(updatedSidebarData);
          } catch (err) {
            console.error("❌ Failed to send updateData:", err);
          }
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
