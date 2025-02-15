const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Function to update the UI dynamically
function updateSidebarUI(data) {
  const container = document.getElementById("sidebar-content");
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p>No keywords found.</p>";
    return;
  }

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "keyword-entry";
    div.innerHTML = `
      <strong>${item.keyword}</strong>: ${item.description} <br>
      <small>${item.file} (Line ${item.line})</small>
    `;
    container.appendChild(div);
  });
}
