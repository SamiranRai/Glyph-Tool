/* eslint-env browser */
/* global acquireVsCodeApi, generateColor */
/* global window, document */

const vscode = acquireVsCodeApi(); // GET THE VSCODE API TO COMMUNICATE
const sidebarUtils = window.sidebarUtils || {};
const sidebarIcons = window.sidebarIcons || {};

const {
  sanitizeInput,
  timeAgo,
  filterTasksBySearch,
  sortDataByTime,
  sortDataByKeywordLength,
  sortDataByAlphabetically,
  extractOriginalKeyword,
  extractTimeFromDescription,
  groupData,
  parseDoneDescription,
  isSidebarDataEmpty,
} = sidebarUtils;

let preDefinedKeywords = [];
let latestBackendData = null;
let latestKeywordData = null;
let Tab = "Task"; // Default
const currentItems = new Map();

const inputKeyword = document.getElementById("keyword-input");
const inputColor = document.getElementById("color-input");
const newKeywordForm = document.getElementById("newKeywordForm");
const mainFeaturesWrapper = document.getElementById("main-features-wrapper");
const keywordManagementView = document.getElementById(
  "keyword-management-view"
);
const addKeyword = document.getElementById("add-keyword");
const backToMain = document.getElementById("back-to-main");

// TAB ELEMENTS
const taskContainer = document.getElementById("Task-content");
const collectionContainer = document.getElementById("Collection-content");
const doneContainer = document.getElementById("Done-content");
const tabElements = document.querySelectorAll(".tabs-header li");
const tabContents = document.querySelectorAll(".whole-tab-content");

// TASK SEARCH INPUT
const taskSearchInput = document.getElementById("input-filter-task");

// DONE SEARCH INPUT
const doneSearchInput = document.getElementById("input-filter-done");

// COLLECTION SEARCH INPUT
const collectionSearchInput = document.getElementById("input-filter-collection");

// DELETE ALL DONE ITEM BUTTON
const deleteAllDoneItemBtn = document.getElementById("deleteAllDoneitemBtn");
const taskItemCount = document.getElementById("task-item-count");
const doneItemCount = document.getElementById("done-item-count");

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

setInterval(() => {
  if (Array.isArray(latestBackendData) && latestBackendData.length > 0) {
    updateSidebarUI(latestBackendData); // Just re-render time labels
  }
}, 60 * 1000); // every 1 minute

window.onload = () => {
  fetchAllKeywords();
  sendMessageToBackend("requestUpdateData");
};

window.addEventListener("blur", () => {
  closeFilterOptions();
});

document.addEventListener("DOMContentLoaded", () => {
  setActiveTab(Tab);
});

window.addEventListener("message", (event) => {
  if (event.data.command === "updateData") {
    const data = event.data.data || [];
    const keyword = event.data.data[0]?.preDefinedKeywords || [];

    if (data.length === 0) {
      return;
    }

    latestBackendData = data;
    latestKeywordData = keyword;
    updateSidebarUI(data);
    updatepreDefinedKeywords(latestKeywordData);
    renderKeywordList();
  }
});

function sendMessageToBackend(command, payload = {}) {
  vscode.postMessage({ command, ...payload });
}

function markDone(keyword, comment, fileName, fullPath, line) {
  const message = {
    action: "done",
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  sendMessageToBackend("toggleMark", message);
}

function markUndo(keyword, comment, fileName, fullPath, line) {
  const message = {
    action: "undo",
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  sendMessageToBackend("toggleMark", message);
}

function markDisable(keyword, comment, fileName, fullPath, line) {
  const message = {
    action: "disable",
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  sendMessageToBackend("toggleMark", message);
}

function markDelete(keyword, comment, fileName, fullPath, line) {
  const message = {
    action: "delete",
    keyword,
    comment,
    fileName,
    fullPath,
    line,
  };

  sendMessageToBackend("toggleMark", message);
}

function deleteAllDoneItems() {
  sendMessageToBackend("deleteAll");
}

deleteAllDoneItemBtn.addEventListener("click", () => {
  deleteAllDoneItems();
});

newKeywordForm.addEventListener("click", (e) => {
  e.preventDefault();
  handleAddKeyword();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleAddKeyword();
  }
});

function handleAddKeyword() {
  let keyword = sanitizeInput(inputKeyword.value);
  const color = inputColor.value;

  if (!keyword) {
    showToast("Please enter a keyword.");
    inputKeyword.focus();
    return;
  }

  const existingKeyword = preDefinedKeywords.some(
    (item) =>
      item.keyword.trim().toLowerCase() === keyword.trim().toLowerCase() + ":"
  );

  if (existingKeyword) {
    showToast("Keyword already exists!");
    inputKeyword.focus();
    return;
  }

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    showToast("Please select a valid color.");
    inputColor.focus();
    return;
  }

  keyword = keyword.toUpperCase() + ":";
  addAKeyword(keyword, color);
  inputKeyword.value = "";
  inputColor.value = "#ffffff";
}

addKeyword.addEventListener("click", () => {
  keywordManagementView.style.display = "block";
  mainFeaturesWrapper.style.display = "none";
});

backToMain.addEventListener("click", () => {
  keywordManagementView.style.display = "none";
  mainFeaturesWrapper.style.display = "block";
});

function renderKeywordList() {
  const keywordList = document.getElementById("keyword-list");
  keywordList.innerHTML = "";

  if (preDefinedKeywords.length === 0) {
    const noKeywordMessage = document.createElement("p");
    noKeywordMessage.textContent = "No Keyword Present!";
    noKeywordMessage.className = "no-keyword-message";

    keywordList.appendChild(noKeywordMessage);
    return;
  }

  preDefinedKeywords.forEach(({ keyword, color }) => {
    const keywordItem = document.createElement("div");
    keywordItem.className = "keyword-item";
    const keywordText = document.createElement("span");
    keywordText.className = "custom-keyword";
    keywordText.textContent = keyword;
    keywordText.style.backgroundColor = color;

    const deleteButton = document.createElement("div");
    deleteButton.className = "delete-button mark-delete-btn";

    const iconSpan = document.createElement("span");
    iconSpan.className = "icon-container";
    iconSpan.setAttribute("data-icon", "delete-icon");

    const buttonText = document.createTextNode("Delete");

    deleteButton.appendChild(iconSpan);
    deleteButton.appendChild(buttonText);

    deleteButton.onclick = () => removeExistingKeyword(keyword);

    keywordItem.appendChild(keywordText);
    keywordItem.appendChild(deleteButton);
    keywordList.appendChild(keywordItem);
  });
}

function fetchAllKeywords() {
  sendMessageToBackend("loadKeywords");
}

function addAKeyword(keyword, color) {
  preDefinedKeywords.push({ keyword, color });
  sendMessageToBackend("addKeyword", { keyword, color });
  renderKeywordList();
}

function removeExistingKeyword(keywordToDelete) {
  preDefinedKeywords = preDefinedKeywords.filter(
    (item) => item.keyword.toLowerCase() !== keywordToDelete.toLowerCase()
  );
  sendMessageToBackend("removeKeyword", { keyword: keywordToDelete });
  renderKeywordList();
}

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

function checkKeyword(keyword) {
  const foundKeyword = preDefinedKeywords.find(
    (pre) => pre.keyword === keyword + ":"
  );

  let bgColor = foundKeyword?.color || generateColor(keyword + ":");
  return bgColor;
}

function setActiveTab(tabId) {
  tabElements.forEach((tab) => tab.classList.remove("active"));
  tabContents.forEach((content) => (content.style.display = "none"));

  const activeTab = document.getElementById(tabId);
  const activeContent = document.getElementById(`${tabId}-tab-content`);

  if (activeTab && activeContent) {
    activeTab.classList.add("active");
    activeContent.style.display = "Block";
    Tab = activeTab.id;

    clearSearchInputForTab(Tab);

    if (latestBackendData && latestKeywordData !== null) {
      updateSidebarUI(latestBackendData);
      updatepreDefinedKeywords(latestKeywordData);
      renderKeywordList();
    }
  }
}

tabElements.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.id);

    if (Array.isArray(latestBackendData) && latestBackendData.length > 0) {
      updateSidebarUI(latestBackendData);
      updatepreDefinedKeywords(latestKeywordData);
      renderKeywordList();
    }
  });
});

function clearSearchInputForTab(Tab) {
  [taskSearchInput, doneSearchInput, collectionSearchInput].forEach(
    (item) => (item.value = "")
  );

  switch (Tab) {
    case "Task":
      doneSearchInput.value = "";
      collectionSearchInput.value = "";
      break;

    case "Done":
      taskSearchInput.value = "";
      collectionSearchInput.value = "";
      break;

    case "Collection":
      taskSearchInput.value = "";
      doneSearchInput.value = "";
      break;
  }
}

function setupSearchListener(searchInputElement) {
  searchInputElement.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredSerachData = filterTasksBySearch(latestBackendData, searchTerm);
    updateSidebarUI(filteredSerachData);
  });
}

setupSearchListener(taskSearchInput);
setupSearchListener(doneSearchInput);

document.addEventListener("click", (e) => {
  const filterButtonTask = e.target.closest("#filter-button-task");
  const filterButtonDone = e.target.closest("#filter-button-done");
  const optionItem = e.target.closest(".option-li");

  if (filterButtonTask) {
    e.stopPropagation();
    document
      .querySelector(".filter-option-container")
      ?.classList.toggle("show-options");
    return;
  }

  if (filterButtonDone) {
    e.stopPropagation();
    document
      .querySelector(".filter-option-container-done")
      ?.classList.toggle("show-options");
    return;
  }

  if (optionItem) {
    e.stopPropagation();
    const type = optionItem.dataset.sort;

    document
      .querySelectorAll(".option-li")
      .forEach((btn) => btn.classList.remove("active"));
    optionItem.classList.add("active");

    let filteredData;

    if (Tab === "Task") {
      filteredData = dataSortFunctions[type]?.(latestBackendData.filter((item) => item.keyword !== "DONE"));
    } else if (Tab === "Done") {
      const enriched = latestBackendData
        .filter((item) => item.keyword === "DONE")
        .map((item) => ({
          ...item,
          keyword: extractOriginalKeyword(item.description), // TEMP keyword
          timeStamp: extractTimeFromDescription(item.description), // TEMP timeStamp
          _originalKeyword: item.keyword,
          _originalTimeStamp: item.timeStamp,
        }));

      const sorted = dataSortFunctions[type]?.(enriched) || [];

      filteredData = sorted.map((item) => ({
        ...item,
        keyword: item._originalKeyword,
        timeStamp: item._originalTimeStamp,
      }));
    } else {
      filteredData = dataSortFunctions[type]?.(latestBackendData);
    }
    if (filteredData) updateSidebarUI(filteredData);

    closeFilterOptions();
    return;
  }

  if (!e.target.closest(".filter-button")) {
    closeFilterOptions();
    return;
  }
});
function closeFilterOptions() {
  document
    .querySelector(".filter-option-container")
    ?.classList.remove("show-options");
  document
    .querySelector(".filter-option-container-done")
    ?.classList.remove("show-options");
}

const dataSortFunctions = {
  alphabetical: sortDataByAlphabetically,
  aesthetic: sortDataByKeywordLength,
  time: sortDataByTime,
};

function renderFallbackIfnoData(data, Tab) {
  if (isSidebarDataEmpty(data)) {
    switch (Tab) {
      case "Task":
        document.querySelector(`#${Tab}-content`).innerHTML = `
        <div class="empty-message">
  <div class="top-level">
    <h2>No ${Tab} Keywords Found!</h2>
    <p>No custom keywords added yet or no match for your search.</p>
  </div>
  <div class="how-to-create-keyword">
    <strong>How to create your first keyword:</strong>
    <ol>
      <li>Open any code file you’re working on.</li>
      <li>Make sure to start with @ before your keyword.</li>
  <li>Add a comment like this anywhere in your code:</li>
  <pre><code>TODO: Refactor login validation</code></pre>
  <li>Or use your own keyword, like:</li>
  <pre><code>IMPROVE: Optimize image loading speed</code></pre>
  <li>The extension will detect it automatically — no need to save.</li>
  <li>Works across all programming languages — like Python, Java, HTML, CSS, and more!</li>
  <li>Example in Python:</li>
  <pre><code>TODO: Clean up this function</code></pre>
    </ol>
    <p>You can write <strong>any custom keyword</strong> you like - there is no limit.</p>
    <p class="bottom-p-tag">Want to highlight it with a custom color? Just click the <strong>"Add New Keyword"</strong> button to create one.</p>
  </div>
</div>
    
        `;
        break;
      case "Done":
        document.querySelector(`#${Tab}-content`).innerHTML = `
        <div class="empty-message">
        <div class="top-level">
      <h2>No Matching Keywords Found</h2>
      <p>You haven’t marked any custom keywords as done yet — or your search didn’t match any completed ones. Once you do, they’ll appear here, and you’ll be able to undo or delete them anytime.</p>
      </div>
      </div>`;

        break;
    }
    return;
  }
}

function renderIndependentItemCount(freshRawData) {
  const excludePreDefinedKeywordData = freshRawData.filter((item) => !item.preDefinedKeywords);

  const taskKeywordData = excludePreDefinedKeywordData.filter((item) => item.keyword !== "DONE");
  const doneKeywordData = excludePreDefinedKeywordData.filter((item) => item.keyword === "DONE");

  if (taskKeywordData.length === 0) {
    taskItemCount.style.display = "none";
  } else {
    taskItemCount.style.display = "block";
    taskItemCount.innerHTML = taskKeywordData.length;
  }

  if (doneKeywordData.length === 0) {
    doneItemCount.style.display = "none";
  } else {
    doneItemCount.style.display = "block";
    doneItemCount.innerHTML = doneKeywordData.length;
  }
}

async function updateSidebarUI(newData) {
  if (!Array.isArray(newData)) {
    return;
  }

  const fragment = document.createDocumentFragment();

  const newKeys = new Set(newData.map((item) => `${item.file}:${item.line}`));

  const targetTabContainer = {
    Task: taskContainer,
    Done: doneContainer,
    Collection: collectionContainer,
  }[Tab];

  targetTabContainer.innerHTML = "";
  currentItems.clear();

  const filteredData =
    {
      Task: newData.filter((item) => item.keyword !== "DONE"),
      Done: newData.filter((item) => item.keyword === "DONE"),
      Collection: groupData(newData.filter((item) => item.keyword !== "DONE")),
    }[Tab] || [];

  renderIndependentItemCount(newData);

  if (renderFallbackIfnoData(filteredData, Tab)) return;

  filteredData.forEach((item) => renderItems(fragment, item));

  currentItems.forEach((el, key) => {
    if (!newKeys.has(key)) {
      el.classList.add("deleted");
      setTimeout(() => {
        targetTabContainer.remove(el);
        currentItems.delete(key);
      }, 1000);
    }
  });

  targetTabContainer.appendChild(fragment);
}

function renderItems(fragment, item) {
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

  const bgColor = checkKeyword(freshKeyword);

  const key = `${file}:${line}`;

  const el = document.createElement("div");
  el.className = "sidebar-item";
  el.dataset.file = file;
  el.dataset.line = line;

  let dataToRender = null;

  switch (Tab) {
    case "Task":
      dataToRender = {
        keyword,
        description,
        bgColor,
        file,
        fullPath,
        line,
        timeStamp,
        Tab,
        item,
      };
      break;

    case "Done":
      const { taskKeyword, createdTimeStamp, detailDescription } = parseDoneDescription(item);
      dataToRender = {
        bgColor,
        file,
        fullPath,
        line,
        createdTimeStamp,
        taskKeyword,
        detailDescription,
        Tab,
        item,
      };
      break;

    case "Collection":
      dataToRender = {
        keyword,
        description,
        bgColor,
        file,
        fullPath,
        line,
        timeStamp,
        Tab,
        item,
      };

      break;

    default:
      console.warn("NO TAB IS OPEN!");
      return; // Exit early
  }

  if (!currentItems.has(key)) {
    try {
      el.innerHTML = getItemHtml(dataToRender);
    } catch (error) {
      console.error("Error in getItemHtml:", error);
    }

    el.addEventListener("click", (e) => {
      if (
        e.target.closest(".mark-done-btn") ||
        e.target.closest(".mark-undo-btn")
      ) {
        return;
      }
      jumpToFileAndLine(fullPath, line);
    });
    currentItems.set(key, el);
    fragment.appendChild(el);
  } else {
    const existingEl = currentItems.get(key);
    const descriptionEl = existingEl.querySelector(".keyword-description");

    if (descriptionEl && descriptionEl.textContent !== description) {
      descriptionEl.textContent = description;
      existingEl.classList.add("updated");
      setTimeout(() => existingEl.classList.remove("updated"), 1000);
    }
  }
}

function getItemHtml({
  keyword,
  description,
  bgColor,
  file,
  fullPath,
  line,
  timeStamp,
  createdTimeStamp,
  taskKeyword,
  detailDescription,
  Tab,
}) {
  switch (Tab) {
    case "Task":
      return `<div class="sidebar-content-wrapper">
      <div class="first-line">
        <div class="keyword-n-description">
          <div class="keyword" style=${
            "background-color:" + bgColor + ";"
          }>${keyword}</div>
          <div class="keyword-description">${description}</div>
        </div>
        <div
        class="done mark-done-btn"
        data-keyword="${keyword}"
        data-comment="${description}"
        data-filename="${file}"
        data-fullpath="${fullPath}"
        data-line="${line}"
        >
        <span
                class="icon-container done-icon"
                data-icon="done3-icon"
              ></span>
              Done
        </div>
      </div>
      <div class="second-line">
      <div class="second-line-left">
        <div class="file-name-wrapper second-line-item">
          <span class="icon-container fileName-icon--container" data-icon="fileName-icon"></span>
          <span class="fileName">${file} </span>
        </div>
        <div class="devider-line"></div>
        <div class="code-line-number-wrapper second-line-item">
          <span class="icon-container codeLineNumber-icon--container" data-icon="codeLineNumber-icon"></span>
          <span class="codeLineNumber"> Line: ${line} </span>
        </div>
        <div class="devider-line"></div>
        <div class="edited-time-wrapper second-line-item">
          <span class="icon-container time-icon--container" data-icon="clock-icon"></span>
          <span class="timeStamp"> ${timeAgo(timeStamp)} </span>
        </div>
        </div>
        <div
        class="mark-disable-btn second-line-right"
        data-keyword="${keyword.toLowerCase()}"
        data-comment="${description}"
        data-filename="${file}"
        data-fullpath="${fullPath}"
        data-line="${line}"
        >
        <span
                class="icon-container"
                data-icon="close-icon"
                title="Disable Keyword"
              ></span>
        </div>
      </div>
    </div>`;

    case "Done":
      return `
          <div class="sidebar-content-wrapper">
            <div class="first-line">
              <div class="keyword-n-description">
                <div class="keyword" style=${
                  "background-color:" + bgColor + ";"
                }>${taskKeyword}</div>
                <div class="keyword-description">${detailDescription} - (FIXED!)</div>
              </div>
              <div class="button-wrapper-delete-undo">
              <div class="mark-undo-btn"
              data-keyword="${taskKeyword}"
              data-comment="${detailDescription}"
              data-filename="${file}"
              data-fullpath="${fullPath}"
              data-line="${line}"
              >
              <span
                class="icon-container"
                data-icon="undo-icon"
              ></span>
              Undo
              </div>
              <div class="mark-delete-btn"
              data-keyword="${taskKeyword}"
              data-comment="${detailDescription}"
              data-filename="${file}"
              data-fullpath="${fullPath}"
              data-line="${line}"
              >
              <span
                class="icon-container"
                data-icon="delete-icon"
              ></span>
              Delete
              </div>
              </div>
            </div>
            <div class="second-line">
              <div class="file-name-wrapper second-line-item">
                <span class="icon-container fileName-icon--container" data-icon="fileName-icon"></span>
                <span class="fileName">${file} </span>
              </div>
              <div class="devider-line"></div>
              <div class="code-line-number-wrapper second-line-item">
                <span class="icon-container codeLineNumber-icon--container" data-icon="codeLineNumber-icon"></span>
                <span class="codeLineNumber"> Line: ${line} </span>
              </div>
              <div class="devider-line"></div>
              <div class="edited-time-wrapper second-line-item">
                <span class="icon-container time-icon--container" data-icon="clock-icon"></span>
                <span class="timeStamp"> ${timeAgo(createdTimeStamp)} </span>
              </div>
            </div>
          </div>`;

    case "Collection":
      return `
      <div class="imp-message-wrapper">
                  <h1>
                    Something Awesome is Coming!
                  </h1>
                  <p>
                    "We're building something special. Your collection will be worth the wait."
                  </p>
                </div>
      `;

    default:
      return "DEFAULT-DATA";
  }
}

function jumpToFileAndLine(fullPath, line) {
  sendMessageToBackend("vscode.open", {
    fullPath,
    line,
  });
}

document.addEventListener("click", (e) => {
  const markDoneBtn = e.target.closest(".mark-done-btn");
  const markUndoBtn = e.target.closest(".mark-undo-btn");
  const markDisableBtn = e.target.closest(".mark-disable-btn");
  const markDeleteBtn = e.target.closest(".mark-delete-btn");

  if (markDoneBtn) {
    e.stopPropagation();
    e.preventDefault();
    const {
      keyword,
      comment,
      filename,
      fullpath,
      line: rawLine,
    } = markDoneBtn.dataset;
    const line = parseInt(rawLine, 10);

    markDone(keyword, comment, filename, fullpath, line);
  } else if (markUndoBtn) {
    e.stopPropagation();
    e.preventDefault();
    const {
      keyword,
      comment,
      filename,
      fullpath,
      line: rawLine,
    } = markUndoBtn.dataset;
    const line = parseInt(rawLine, 10);

    markUndo(keyword, comment, filename, fullpath, line);
  } else if (markDisableBtn) {
    e.stopPropagation();
    e.preventDefault();
    const {
      keyword,
      comment,
      filename,
      fullpath,
      line: rawLine,
    } = markDisableBtn.dataset;
    const line = parseInt(rawLine, 10);

    markDisable(keyword, comment, filename, fullpath, line);
  } else if (markDeleteBtn) {
    e.stopPropagation();
    e.preventDefault();
    const {
      keyword,
      comment,
      filename,
      fullpath,
      line: rawLine,
    } = markDeleteBtn.dataset;
    const line = parseInt(rawLine, 10);

    markDelete(keyword, comment, filename, fullpath, line);
  }
});
sidebarIcons.loadIcons(document);
sidebarIcons.observeIcons();
