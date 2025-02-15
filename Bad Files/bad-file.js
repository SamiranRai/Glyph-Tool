/*
function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "helloWorld.sayHello",
    async function () {
      vscode.window.showInformationMessage("Scanning all Files.....");

      try {
        // Default KEYWORD: BUG, FIX, TODO
        const defaultKeyword = ["BUG:", "FIX:", "TODO:"];

        // All File defined By Extension
        const fileExtensions = [
          "js",
          "ts",
          "jsx",
          "tsx", // JavaScript & TypeScript
          "py",
          "java",
          "cpp",
          "c",
          "cs",
          "go",
          "rb",
          "php",
          "rs",
          "kt",
          "swift",
          "dart", // Backend languages
          "html",
          "css",
          "scss",
          "less", // Web design files
          "json",
          "yaml",
          "yml",
          "xml", // Config & Data files
          "sh",
          "bash",
          "bat",
          "ps1",
          "zsh", // Scripting files
          "md",
          "txt", // Documentation files
          "sql", // Database scripts
          "r",
          "jl",
          "m",
          "pl",
          "lua", // Other languages (R, Julia, MATLAB, Perl, Lua)
        ];

        // Pattern to match the File defined By Extension
        const pattern = 
        `**/
/*        *.{${fileExtensions.join(",")}}`;

        // Vs-Code File Module to find the file Based on Pattern
        const files = await vscode.workspace.findFiles(pattern);

        // Making an Empty Aray of Matching File:
        const matchingFiles = [];

        // Lopping through each file to find the FilePath
        for (const file of files) {
          const document = vscode.workspace.openTextDocument(file);
          const content = (await document).getText();
          const lines = content.split("\n");

          let filePrinted = false;

          lines.forEach((line, index) => {
            defaultKeyword.forEach((keyword) => {
              if (line.includes(keyword)) {
                if (!filePrinted) {
                  console.log(`\n📂 File: ${file.fsPath}`);
                  filePrinted = true;
                }

                console.log(`   🔹 Line ${index + 1}: ${line.trim()}`);
              }
            });
          });
        }

        vscode.window.showInformationMessage(
          "Keyword search completed! Check console."
        );

        // A ERROR Handling mechanisim;
      } catch (error) {
        console.log("Error Fetchinh the Files", {
          error: error,
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

*/
