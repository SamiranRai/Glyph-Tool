const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Function to update the UI dynamically (optimized)
function updateSidebarUI(data) {
  const container = document.getElementById("task-list");

  container.innerHTML = ""; // Clear existing content before updating

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "task-entry";
    div.innerHTML = `
      <div class="task-header">
        <span class="fixme-label ${item.keyword}">${item.keyword}</span>
      </div>
      <p class="task-title">${item.description}</p>
      <div class="task-meta">
        <span>📄 ${item.file}</span> |
        <span>🔢 Line: ${item.line}</span> |
        <span>⏰ ${item.time}</span>
      </div>
    `;
    container.appendChild(div);
  });
}
