const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Conversion of timeStamp into readble format
const timeAgo = (timestamp) => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, seconds] of Object.entries(intervals)) {
    const count = Math.floor(diffInSeconds / seconds);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
};

// Function to update the UI dynamically (optimized)
function updateSidebarUI(newData) {
  // Looping through each data - Obj
  newData.forEach((item) => {
    // Extracted data from Item - Obj
    const { keyword, description, file, fullPath, line, timeStamp, snippet } =
      item;

    console.log(`${keyword}: ${timeStamp}`);

    // Neccesery Data Trabsformation (ex. TimeStamp)

    // Each keyword get's their background color based on "String Hashing algorithm, already aplied in backend"

    // Render -> Final Step;
  });
}

// Load the icons
loadIcons();

// FRONTEND ONLY CODE --->
// Static UI Part --->

const loadIcons = () => {
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
};
