const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Function to update the UI dynamically (optimized)
function updateSidebarUI(data) {
  const container = document.getElementById("sidebar-content");

  const existingKeywords = new Map();
  container.querySelectorAll(".keyword-entry").forEach((div) => {
    const keyword = div.getAttribute("data-keyword");
    existingKeywords.set(keyword, div);
  });

  const newKeywords = new Set(data.map((item) => item.keyword));

  // 🔹 ADD or UPDATE keywords
  data.forEach((item) => {
    if (existingKeywords.has(item.keyword)) {
      // ✅ Update existing keyword entry
      const div = existingKeywords.get(item.keyword);
      div.innerHTML = `
        <strong>${item.keyword}</strong>: ${item.description} <br>
        <small>${item.file} (Line ${item.line})</small>
      `;
    } else {
      // ✅ Add new keyword entry
      const div = document.createElement("div");
      div.className = "keyword-entry";
      div.setAttribute("data-keyword", item.keyword);
      div.innerHTML = `
        <strong>${item.keyword}</strong>: ${item.description} <br>
        <small>${item.file} (Line ${item.line})</small>
      `;
      container.appendChild(div);
    }
  });

  // 🔹 REMOVE deleted keywords
  existingKeywords.forEach((div, keyword) => {
    if (!newKeywords.has(keyword)) {
      div.remove();
    }
  });
}
