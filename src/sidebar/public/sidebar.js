const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

// Send requset to the extension when the sidebar is load
window.addEventListener("DOMContentLoaded", () => {
  vscode.postMessage({ command: "fetchData" });
});

// Listen for message from backend
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.command === "updateData") {
    console.log("updateData:" + message.data);
    // pass the data to "updateUI()" function
    updateUI(message.data);
  }
});

// UpdateUI Function
function updateUI(data) {
  const container = document.getElementById("data-container");
  container.innerHTML = ""; // clear old Data

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "keyword-item";
    div.innerHTML = `<strong>${item.keyword}:</strong> ${item.description} <br> 📄 ${item.file} (Line ${item.line})`;
    container.appendChild(div);
  });
}
