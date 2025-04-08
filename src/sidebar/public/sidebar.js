const vscode = acquireVsCodeApi(); // GET THE VSCODE API TO COMMUNICATE

// GLOBAL FLAG
let isButtonAtached = false;
let preDefinedKeywords = [];

// KEYWORD MANAGEMENT ELEMENTS
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

// FETCH ALL KEYWORDS WHEN THE SIDEBAR LOAD..
window.onload = () => {
  fetchAllKeywords();
};

// MAIN EVENT LISTENER
window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
    updatepreDefinedKeywords(event.data.keyword);
    renderKeywordList();
  }
});

// FUNCTION TO SEND MESSAGE TO BACKEND
function sendMessageToBackend(command, payload = {}) {
  vscode.postMessage({ command, ...payload });
}

// FUNCTION TO MARK AS DONE
function markDone(keyword, comment, fileName, fullPath, line) {
  // get the relevent item - where done is clicked;
  const message = {
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  // SEND MESSAGE TO BACKEND
  sendMessageToBackend("markAsDone", message);
}

// FUNCTION TO MARK AS UNDO
function undoDone(keyword, comment, fileName, fullPath, line) {
  // get the relevent item - where done is clicked;
  const message = {
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  // SEND MESSAGE TO BACKEND
  sendMessageToBackend("undoDone", message);
}

// CUSTOM ERROR MESSAGE (FRONTEND)
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// <--------- KEYWORD MANAGEMENT UI :START --------->

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

  // RESET FORM
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
  keywordManagementView.style.display = "none"; // HIDE IT
  mainFeaturesWrapper.style.display = "block"; // DISPLAY IT
});

// RENDER PREDEFINED KEYWORDS(FRONTEND)
function renderKeywordList() {
  const keywordList = document.getElementById("keyword-list");
  keywordList.innerHTML = ""; // CLEAR EXISTING KEYWORD

  preDefinedKeywords.forEach(({ keyword, color }) => {
    const keywordItem = document.createElement("div");
    keywordItem.className = "keyword-item";
    keywordItem.style.backgroundColor = color;

    // KEYWORD TEXT
    const keywordText = document.createElement("span");
    keywordText.textContent = keyword;

    // DELETE BUTTON
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
  preDefinedKeywords.push({ keyword, color }); // OPTIMISTIC UPDATE
  renderKeywordList();
}

// REMOVE A EXITING KEYWORD
function removeExistingKeyword(keywordToDelete) {
  console.log("removeExistingKeyword:", keywordToDelete);

  // SEND MESSAGE TO BACKEND
  sendMessageToBackend("removeKeyword", { keyword: keywordToDelete });

  // UPDATE THE ARRAY
  preDefinedKeywords = preDefinedKeywords.filter(
    ({ keyword }) => keyword !== keywordToDelete
  );

  // RENDER THE LIST
  renderKeywordList();
}

// <--------- KEYWORD MANAGEMENT UI :END --------->

// <--------- BASIC UI SUUPPORTS :START --------->

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

  const diff = Math.floor((now - timeStamp) / 1000); // DIFFERENCE IN SECONDS

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

// <--------- KEYWORD MANAGEMENT UI :END --------->

// <--------- MAIN UI RENDER :START --------->

// FINAL RENDER->>>
// TASK CONTAINER for "HOLDING EACH TASK"
const taskContainer = document.getElementById("Task-content");
const collectionContainer = document.getElementById("Collection-content");
const doneContainer = document.getElementById("Done-content");

const currentItems = new Map();
// Automatically Assign based on active tab
let Tab = "Task"; // Default Tab -> "Task"

// function getActiveTab() {
//   return document.querySelector(".tabs-header .active")?.id || Tab;
// }

// // TAB SWITCHING MECHANISIM
// document.querySelectorAll(".tabs-header li").forEach((tab) => {
//   tab.addEventListener("click", function () {
//     // REMOVE ACTIVE CLASS FROM ALL THE TABS
//     document.querySelectorAll(".tabs-header li").forEach((t) => {
//       t.classList.remove("active");
//       document.getElementById(t.id + "-content").style.display = "none"; // Hide all tab content
//     });

//     // ADD ACTIVE CLASS TO CLICKED TAB
//     this.classList.add("active");

//     // UPDATE THE TAB VARIABLE WITH ACTIVE TAB ID
//     Tab = this.id;

//     // SHOW THE CONTENT OF ACTIVE TAB
//     document.getElementById(this.id + "-content").style.display = "block";

//     // Log the active tab inside the event listener
//     console.log("Active Tab (Inside Event):", getActiveTab());
//   });
// });

// // INTIALLY SHOW ONLY ACTIVE TAB CONTENT
// document.addEventListener("DOMContentLoaded", () => {
//   document.querySelectorAll(".tabs-header li").forEach((tab) => {
//     if (tab.id === Tab) {
//       tab.classList.add("active");
//       document.getElementById(tab.id + "-content").style.display = "block";
//     } else {
//       document.getElementById(tab.id + "-content").style.display = "none";
//     }
//   });

//   // Log the active tab after page load
//   console.log("Active Tab (On Load):", getActiveTab());
// });

// // Example: Log active tab anytime outside of click event
// setInterval(() => {
//   console.log("Active Tab (Outside Event):", getActiveTab());
// }, 2000); // Check every 2 seconds

// console.log("Tab:Debug", Tab);

// UPDATESIDEBARUI() FUNCTION UPDATES AUTOMATICALLY WHEN NEW DATA ARRIVES
async function updateSidebarUI(newData) {
  const fragment = document.createDocumentFragment();

  // UNIQUE KEYS FOR EACH SIDEBAR-ITEM
  const newKeys = new Set(newData.map((item) => `${item.file}:${item.line}`));

  // DETERMINE WHICH CONTAINER TO USE BASED ON ACTIVE TAB
  const targetTabContainer = {
    Task: taskContainer,
    Done: doneContainer,
    Collection: collectionContainer,
  }[Tab];

  // CHECKED: console.log("Debug::targetTabContainer:", targetTabContainer);

  // CLEAR THE PREVIOUS CONTENT ACCODING TO TAB
  targetTabContainer.innerHTML = ""; //-- IMP! -- issue can be here
  currentItems.clear();

  // FILTER THE DATA ACCORDINT TO ACTIVE TAB
  const filteredData =
    {
      Task: newData.filter((item) => item.keyword !== "DONE"),
      Done: newData.filter((item) => item.keyword === "DONE"),
      Collection: "COLLECTION-DATA",
    }[Tab] || [];

  // CHECKED: console.log("Debug::filteredData:", filteredData);

  // CHECK IF THE TAB HAVE DATA!
  if (!filteredData || filteredData.length === 0) {
    console.log("NO-DATA-AVIALBLE");
    return;
  }

  // RENDER THE ITEM BASED ON TAB
  filteredData.forEach((item) =>
    renderItems(fragment, item, targetTabContainer)
  );

  // CHECKED: console.log("Debug::currentItems:", currentItems);
  // CHECKED: console.log("Debug::newKeys:", newKeys);
  // REMOVE DELTED ITEMS
  currentItems.forEach((el, key) => {
    // CHECKED: console.log("Debug::currentItems:", { el, key });
    if (!newKeys.has(key)) {
      el.classList.add("deleted");
      setTimeout(() => {
        targetTabContainer.remove(el); // Update Tab-Content
        currentItems.delete(key); // update currentItems
      }, 1000);
    }
  });

  // APPEND ONLY NEW ITEMS
  targetTabContainer.appendChild(fragment);
}

// FUNCTION TO RENDER ITEMS
function renderItems(fragment, item, targetTabContainer) {
  // EXTRACT THE DATA FROM ITEM
  const {
    keyword,
    fullPath,
    description,
    file,
    line,
    timeStamp,
    preDefinedKeywords,
  } = item;

  // LOAD "updatepreDefinedKeywords"
  updatepreDefinedKeywords(preDefinedKeywords);

  // CHECK FOR FRESHKEYWORD
  const freshKeyword = typeof keyword === "string" ? keyword : null;
  if (!freshKeyword) return;

  // RETURN BACKGROUND COLOR
  const bgColor = checkKeyword(freshKeyword);

  // KEY
  const key = `${file}:${line}`;
  console.log("Debug::key:", key);

  // BASIC UI HTML STRUCTURE
  const el = document.createElement("div");
  el.className = "sidebar-item";
  el.dataset.file = file;
  el.dataset.line = line;

  // HOLD ACTIVE TAB DATA
  let dataToRender = null;

  // PASS DATA ACCORING TO ACTIVE TAB
  switch (Tab) {
    // PASS TASK DATA
    case "Task":
      dataToRender = {
        keyword,
        description,
        bgColor,
        file,
        line,
        timeStamp,
        Tab,
      };
      break;

    // PASS DONE DATA
    case "Done":
      // EXTRACTING DATA FROM "parseDescription" FUNCTION
      const { taskKeyword, createdTimeStamp, detailDescription } =
        parseDescription(item);
      dataToRender = {
        bgColor,
        file,
        line,
        createdTimeStamp,
        taskKeyword,
        detailDescription,
        Tab,
      };
      break;

    // PASS COLLECTION DATA
    case "Collection":
      console.log("Collection UI Render");
      return; // Exit early since no UI updates needed

    // PASS DEFAULT DATA
    default:
      console.log("NO TAB IS OPEN!");
      return; // Exit early
  }

  if (!currentItems.has(key)) {
    console.log("New Items Added");
    console.log("Debug::Adding new item:", key);
    try {
      console.log("Debug::Data to render:", dataToRender);
      el.innerHTML = getItemHtml(dataToRender);
    } catch (error) {
      console.error("Error in getItemHtml:", error);
    }

    el.addEventListener("click", () => jumpToFileAndLine(fullPath, line));
    currentItems.set(key, el);
    fragment.appendChild(el);
  } else {
    console.log("n");
    console.log(
      "Debug::Item already exists, checking for description update..."
    );
    const existingEl = currentItems.get(key);
    const descriptionEl = existingEl.querySelector(".keyword-description");

    if (descriptionEl && descriptionEl.textContent !== description) {
      console.log("Debug::Updating description...");
      descriptionEl.textContent = description;
      existingEl.classList.add("updated");
      setTimeout(() => existingEl.classList.remove("updated"), 1000);
    }
  }

  targetTabContainer.appendChild(fragment);
}

// FUNCTION TO HANDLE ONLY HTML PART
function getItemHtml({
  keyword,
  description,
  bgColor,
  file,
  line,
  timeStamp,
  createdTimeStamp,
  taskKeyword,
  detailDescription,
  Tab,
}) {
  console.log("Debug::getItemHtml:", {
    message: "getItemHtml is Called!",
    Tab,
  });

  switch (Tab) {
    // TASK UI -> HTML
    case "Task":
      return `<div class="sidebar-content-wrapper">
      <div class="first-line">
        <div class="keyword-n-description">
          <div class="keyword" style=${
            "background-color:" + bgColor + ";"
          }>${keyword}:</div>
          <div class="keyword-description">${description}</div>
        </div>
        <div class="done">UNDO</div>
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

    // DONE UI -> HTML
    case "Done":
      return `
          <div class="sidebar-content-wrapper">
            <div class="first-line">
              <div class="keyword-n-description">
                <div class="keyword" style=${
                  "background-color:" + bgColor + ";"
                }>${taskKeyword}:</div>
                <div class="keyword-description">${detailDescription} - (FIXED!)</div>
              </div>
              <div class="done">UNDO</div>
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
                <span class="timeStamp"> ${timeAgo(createdTimeStamp)} </span>
              </div>
            </div>
          </div>`;

    // COLLECTION UI -> HTML
    case "Collection":
      return "COLLECTION-DATA";

    // DEFAULT UI -> HTML
    default:
      return "DEFAULT-DATA";
  }
}

// PARSE INFORMATION FOR DONE
function parseDescription(item) {
  const {
    keyword,
    fullPath,
    description,
    file,
    line,
    timeStamp,
    preDefinedKeywords,
  } = item;

  // Extract task name (inside the first quotes)
  const taskMatch = description.match(/^"([^"]+)"/);
  const taskKeyword = taskMatch ? taskMatch[1] : "Unknown Task";

  // Extract timestamp (inside the last quotes)
  const timestampMatch = description.match(/"([^"]+\d{1,2}[:.]\d{2}[APM]*)"/);
  const createdTimeStamp = timestampMatch ? timestampMatch[1] : "Unknown Time";

  // Extract pure description (middle part between keyword and timestamp)
  const descMatch = description.match(/^"[^"]+"\s*-\s*([^"]+)\s*"[^"]+"$/);
  const detailDescription = descMatch
    ? descMatch[1].trim()
    : "No description available";

  return {
    taskKeyword,
    createdTimeStamp,
    detailDescription,
  };
}

// FUNCTION TO JUMPING FILE AND LINE...
function jumpToFileAndLine(fullPath, line) {
  // Send message to the Backend
  sendMessageToBackend("vscode.open", {
    fullPath,
    line,
  });
}

// FRONTEND ONLY CODE --->
// STATIC UI PART --->

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

// LOAD...
loadIcons();
