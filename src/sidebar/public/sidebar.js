const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate
// Global Flag
let isButtonAtached = false;
let preDefinedKeywords = [];

// Fetch all keywords when the sidebar loads
window.onload = () => {
  fetchAllKeywords();
};

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
    updatepreDefinedKeywords(event.data.keyword);
    renderKeywordList();
  }
});

// Function to send message to the backend
function sendMessageToBackend(command, payload = {}) {
  vscode.postMessage({ command, ...payload });
}

// Function to mark as DONE
function markDone(keyword, comment, fileName, fullPath, line) {
  // get the relevent item - where done is clicked;
  const message = {
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  console.log("Debug::Data:", message);
  // Send back to the backend
  sendMessageToBackend("markAsDone", message);
  console.log("Debug::MarkAsDOne: Successfully sent data to backend!");
}

// Function to mark as UNDO
function undoDone(keyword, comment, fileName, fullPath, line) {
  // get the relevent item - where done is clicked;
  const message = {
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  // Send back to the backend
  sendMessageToBackend("undoDone", message);
}

// KEYWORD MANAGEMENT -> ADD, DELETE, UPDATE, MODIFY
const inputKeyword = document.getElementById("keyword-input");
const inputColor = document.getElementById("color-input");
const newKeywordForm = document.getElementById("newKeywordForm");
const mainFeaturesWrapper = document.getElementById("main-features-wrapper");
const keywordList = document.getElementById("keyword-list");
const keywordManagementView = document.getElementById(
  "keyword-management-view"
);
const addKeyword = document.getElementById("add-keyword");
const backToMain = document.getElementById("back-to-main");

// CUSTOM ERROR MESSAGE (FRONTEND)
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// BUTTON TO ADD KEYWORD(FRONTEND)
newKeywordForm.addEventListener("click", () => {
  let keyword = inputKeyword.value.trim();
  const color = inputColor.value;

  if (!keyword) {
    showToast("Please enter a keyword.");
    inputKeyword.focus();
    return;
  }

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    showToast("Please select a valid color.");
    inputColor.focus();
    return;
  }

  // ADD KEYWORD IF INPUT IS VALID!
  // Convert normal -> NORMAL:
  keyword = keyword.toUpperCase() + ":";
  addAKeyword(keyword, color);

  // Reset form after adding
  inputKeyword.value = "";
  inputColor.value = "#ffffff";
});

// OPEN THE KEYWORD MANGEMENT UI(FRONTEND)
addKeyword.addEventListener("click", () => {
  keywordManagementView.style.display = "block"; // display it
  mainFeaturesWrapper.style.display = "none"; // hide it
});

// BACK TO MAIN UI(FRONTEND)
backToMain.addEventListener("click", () => {
  keywordManagementView.style.display = "none"; // hide it
  mainFeaturesWrapper.style.display = "block"; // display it
});

// RENDER PREDEFINED KEYWORDS(FRONTEND)
function renderKeywordList() {
  const keywordList = document.getElementById("keyword-list");
  keywordList.innerHTML = ""; // Clear existing keywords

  preDefinedKeywords.forEach(({ keyword, color }) => {
    const keywordItem = document.createElement("div");
    keywordItem.className = "keyword-item";
    keywordItem.style.backgroundColor = color;

    // Keyword text
    const keywordText = document.createElement("span");
    keywordText.textContent = keyword;

    // Delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "X";
    deleteButton.className = "delete-button";
    deleteButton.onclick = () => removeExistingKeyword(keyword);

    keywordItem.appendChild(keywordText);
    keywordItem.appendChild(deleteButton);
    keywordList.appendChild(keywordItem);
  });
}

// BACKEND CALL FOR MANAGING KEYWORDS -> CREATE, UPDATE, DELETE

// FETCH ALL KEYWORDS
function fetchAllKeywords() {
  sendMessageToBackend("loadKeywords");
}

// ADD A KEYWORD(CREATE)
function addAKeyword(keyword, color) {
  sendMessageToBackend("addKeyword", { keyword, color });
  preDefinedKeywords.push({ keyword, color }); // Optimistic update
  renderKeywordList();
}

// Remove a keyword
function removeExistingKeyword(keywordToDelete) {
  console.log("removeExistingKeyword:", keywordToDelete);

  // send message to the backend
  sendMessageToBackend("removeKeyword", { keyword: keywordToDelete });

  // Update the array
  preDefinedKeywords = preDefinedKeywords.filter(
    ({ keyword }) => keyword !== keywordToDelete
  );

  // render the list
  renderKeywordList();
}

// ✅ Update an existing keyword's color
// function updateExistingKeyword() {
//   const keyword = prompt("Enter keyword to update:");
//   if (!keyword) return;
//   const newColor = prompt("Enter new color for keyword:", "#FF5733");
//   sendMessageToBackend("updateKeyword", { keyword, newColor });
// }

// Highlighting keyword based on Text Hashing Algo.
// function getBgColorBasedOnText(keyword) {
//   return 0;
// }

// UPDATE PREDEFINED KEYWORD
// function updatepreDefinedKeywords(newKeywords) {
//   if (!Array.isArray(newKeywords)) {
//     return;
//   }
//   // Clear the old one and store the new one
//   preDefinedKeywords = [...newKeywords];
// }

function updatepreDefinedKeywords(newKeywords) {
  if (!Array.isArray(newKeywords)) {
    return;
  }
  newKeywords.forEach((newKeyword) => {
    if (!preDefinedKeywords.some((pre) => pre.keyword === newKeyword.keyword)) {
      preDefinedKeywords.push(newKeyword);
    }
  });
}

// CHECK KEYWORD
function checkKeyword(keyword) {
  const foundKeyword = preDefinedKeywords.find(
    (pre) => pre.keyword === keyword + ":"
  );

  let bgColor = foundKeyword?.color || generateColor(keyword + ":");
  return bgColor;
}

// CONVERT THE TIMESTAMP INTO READBLE FORMAT
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

// FINAL RENDER->>>
// TASK CONTAINER for "HOLDING EACH TASK"
const taskContainer = document.getElementById("tasks");
const currentItems = new Map();

// UPDATESIDEBARUI() FUNCTION UPDATES AUTOMATICALLY WHEN NEW DATA ARRIVES
async function updateSidebarUI(newData) {
  const fragment = document.createDocumentFragment();
  const newKeys = new Set(newData.map((item) => `${item.file}:${item.line}`));

  // Update or Add Items
  newData.forEach((item) => {
    const {
      keyword,
      fullPath,
      description,
      file,
      line,
      timeStamp,
      preDefinedKeywords,
    } = item;
    updatepreDefinedKeywords(preDefinedKeywords);

    const freshKeyword = typeof keyword === "string" ? keyword : null;
    if (!freshKeyword) return;

    // RETURN BACKGROUND COLOR
    const bgColor = checkKeyword(freshKeyword);
    console.log("Debug::", { keyword, bgColor });

    const key = `${file}:${line}`;
    if (!currentItems.has(key)) {
      const el = document.createElement("div");
      el.className = "sidebar-item";
      el.dataset.file = file;
      el.dataset.line = line;
      el.innerHTML = `
        <div class="sidebar-content-wrapper">
          <div class="first-line">
            <div class="keyword-n-description">
              <div class="keyword" style=${
                "background-color:" + bgColor + ";"
              }>${keyword}:</div>
              <div class="keyword-description">${description}</div>
            </div>
            <div class="done">DONE</div>
          </div>
          <div class="second-line">
            <div class="file-name-wrapper second-line-item">
              <span class="icon-container fileName-icon--container" data-icon="fileName-icon"></span>
              <span class="fileName"> ${file} </span>
            </div>
            <div class="devider-line"></div>
            <div class="code-line-number-wrapper second-line-item">
              <span class="icon-container codeLineNumber-icon--container" data-icon="codeLineNumber-icon"></span>
              <span class="codeLineNumber"> Line: ${line} </span>
            </div>
            <div class="devider-line"></div>
            <div class="edited-time-wrapper second-line-item">
              <span class="icon-container time-icon--container" data-icon="time-icon"></span>
              <span class="timeStamp"> ${timeAgo(timeStamp)} </span>
            </div>
          </div>
        </div>`;

      // Add click event listener to jump to file and line
      el.addEventListener("click", () => jumpToFileAndLine(fullPath, line));

      currentItems.set(key, el);
      fragment.appendChild(el);
    } else {
      const existingEl = currentItems.get(key);
      const descriptionEl = existingEl.querySelector(".keyword-description");
      if (descriptionEl.textContent !== description) {
        descriptionEl.textContent = description;
        existingEl.classList.add("updated");
        setTimeout(() => existingEl.classList.remove("updated"), 1000);
      }
    }
  });

  // Remove Deleted Items
  currentItems.forEach((el, key) => {
    if (!newKeys.has(key)) {
      el.classList.add("deleted");
      setTimeout(() => {
        taskContainer.removeChild(el);
        currentItems.delete(key);
      }, 1000);
    }
  });

  // Append only new items
  taskContainer.appendChild(fragment);
}

// Function to handle jumping to file and line
function jumpToFileAndLine(fullPath, line) {
  // Send message to the Backend
  sendMessageToBackend("vscode.open", {
    fullPath,
    line,
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
