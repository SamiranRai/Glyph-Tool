const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Function to send message to the backend
function sendMessageToBackend(command, payload = {}) {
  vscode.postMessage({ command, ...payload });
}

// Fetch all keyword from Backend
// function fetchAllKeywords() {
//   sendMessageToBackend("loadKeywords");
// }

// Add a keyword
function addAKeyword(keyword, color) {
  // Send message to the backend
  sendMessageToBackend("addKeyword", { keyword, color });
}

// ✅ Update an existing keyword's color
// function updateExistingKeyword() {
//   const keyword = prompt("Enter keyword to update:");
//   if (!keyword) return;
//   const newColor = prompt("Enter new color for keyword:", "#FF5733");
//   sendMessageToBackend("updateKeyword", { keyword, newColor });
// }

// // ✅ Remove a keyword
// function removeExistingKeyword() {
//   const keyword = prompt("Enter keyword to remove:");
//   if (!keyword) return;
//   const confirmDelete = confirm(
//     `Are you sure you want to remove "${keyword}"?`
//   );
//   if (confirmDelete) {
//     sendMessageToBackend("removeKeyword", { keyword });
//   }
// }

// Highlighting keyword based on Text Hashing Algo.
// function getBgColorBasedOnText(keyword) {
//   return 0;
// }

// Global Flag
let isButtonAtached = false;
let preDefinedKeywords = [];

function updatepreDefinedKeywords(newKeywords) {
  if (!Array.isArray(newKeywords)) {
    return;
  }
  // Clear the old one and store the new one
  preDefinedKeywords = [...newKeywords];
  console.log("Updated Keywords:", preDefinedKeywords);
}

function checkKeyword(keyword) {
  const foundKeyword = preDefinedKeywords.find(
    (pre) => pre.keyword === keyword + ":"
  );

  let bgColor = foundKeyword?.color || generateColor(keyword + ":");
  return bgColor;
}

function timeAgo(timeStamp) {
  if (!timeStamp || isNaN(timeStamp)) return "Invalid timestamp";

  const now = Date.now();
  if (timeStamp > now) return "In the future";

  const diff = Math.floor((now - timeStamp) / 1000); // Difference in seconds

  const units = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(diff / unit.seconds);
    if (count >= 1) return `${count} ${unit.label}${count > 1 ? "s" : ""} ago`;
  }

  return `${diff} second${diff !== 1 ? "s" : ""} ago`;
}

// Function to update the UI dynamically (optimized)
async function updateSidebarUI(newData) {
  const button1 = document.getElementById("add-keyword");
  if (!isButtonAtached) {
    button1.addEventListener("click", () => {
      const input = document.getElementById("input-filter-task").value; // Get latest value inside event
      addAKeyword(input, input);
      console.log("Successfully added +:", input);
    });

    isButtonAtached = true;
  }
  newData.forEach((item) => {
    // Extracted data from Item - Obj
    const {
      keyword,
      description,
      file,
      fullPath,
      line,
      timeStamp,
      snippet,
      preDefinedKeywords,
    } = item;

    // Store the predefined keyword in global array
    updatepreDefinedKeywords(preDefinedKeywords);

    console.log("Time:", timeAgo(timeStamp)); // Example usage

    // Check, if the keyword is undefind
    const freshKeyword = typeof keyword === "string" ? keyword : null;
    if (!freshKeyword) {
      return null;
    }
    // get bgColor
    const bgColor = checkKeyword(freshKeyword);
    console.log({ keyword, bgColor });

    // Neccesery Data Trabsformation (ex. TimeStamp)

    // Each keyword gets its background color based on "String Hashing algorithm, already applied in backend"

    // Render -> Final Step;
  });
}

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

// Load the icons
loadIcons();
