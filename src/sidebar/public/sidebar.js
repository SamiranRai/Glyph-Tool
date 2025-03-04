const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Function to update the UI dynamically (optimized)
function updateSidebarUI(data) {
  console.log("Hello from Frontend!");
}

// Static UI Part --->

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".icon-container").forEach((iconElement) => {
    const iconName = iconElement.getAttribute("data-icon");
    const iconPath = `${iconsBaseUri}/${iconName}.svg`;

    fetch(iconPath)
      .then((response) => response.text())
      .then((svg) => {
        iconElement.innerHTML = svg;
      })
      .catch((error) =>
        console.error(`Error loading icon: ${iconName}`, error)
      );
  });
});
