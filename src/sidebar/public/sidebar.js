const vscode = acquireVsCodeApi(); // ✅ Get VS Code API to communicate

// Store the keyword Dynamically
const existingKeywords = new Map();

window.addEventListener("message", (event) => {
  console.log("✅ Sidebar received message:", event.data);

  if (event.data.command === "updateData") {
    updateSidebarUI(event.data.data);
  }
});

// Convert timestamp to readable format (super fast)
// const formatTimestamp = (timestamp) => {
//   if (!timestamp) return "NO-TIME_STAMP";

//   return new Intl.DateTimeFormat("en-US", {
//     weekday: "short",
//     month: "short",
//     day: "2-digit",
//     year: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: true,
//   }).format(new Date(timestamp));
// };

// Function to update the UI dynamically (optimized)
function updateSidebarUI(newData) {
  console.log("Hello from Frontend!", newData);

  const tabContent = document.querySelector(".tab-content");
  if (!tabContent) return;

  const newKeywordSet = new Set(
    newData.map((task) => `${task.fullPath}-${task.line}`)
  );

  // add new task if they dont exist
  newData.forEach((task) => {
    const uniqueTaskKey = `${task.fullPath}-${task.line}`;
    if (!existingKeywords.has(uniqueTaskKey)) {
      const taskElement = document.createElement("div");
      taskElement.classList.add("sidebar-item");
      taskElement.dataset.taskId = uniqueTaskKey;

      // Dynamic--Html--code
      taskElement.innerHTML = `
        <div class="sidebar-content-wrapper">
          <div class="first-line">
            <div class="keyword-n-description">
              <div class="keyword">${task.keyword}:</div>
              <div class="keyword-description">${task.description}</div>
            </div>
            <div class="done">PENDING</div> 
          </div>

          <div class="second-line">
            <div class="file-name-wrapper second-line-item">
              <span class="icon-container fileName-icon--container" data-icon="fileName-icon"></span>
              <span class="fileName">${task.file}</span>
            </div>

            <div class="devider-line"></div>

            <div class="code-line-number-wrapper second-line-item">
              <span class="icon-container codeLineNumber-icon--container" data-icon="codeLineNumber-icon"></span>
              <span class="codeLineNumber">Line: ${task.line}</span>
            </div>

            <div class="devider-line"></div>

            <div class="edited-time-wrapper second-line-item">
              <span class="icon-container time-icon--container" data-icon="time-icon"></span>
              <span class="timeStamp">${
                /*formatTimestamp(task.timeStamp)*/ task.timeStamp
              }</span>
            </div>
          </div>
        </div>
      `;
      tabContent.appendChild(taskElement);
      existingKeywords.set(uniqueTaskKey, taskElement); // to track in memory
    }

    // **2. Remove deleted tasks**
    existingKeywords.forEach((element, key) => {
      if (!newKeywordSet.has(key)) {
        tabContent.removeChild(element);
        existingKeywords.delete(key);
      }
    });
  });

  // Load the icons
  loadIcons();
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
