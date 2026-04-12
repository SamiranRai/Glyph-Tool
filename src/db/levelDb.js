const { generateKeywordKey } = require("../shared/key-generator");

let highlightTimeStamps = new Map();

// Debounce timer for batching rapid consecutive saves into a single globalState write.
let persistDebounceTimer = null;

async function initDB(context) {
  try {
    const data = await context.globalState.get("highlightTimeStamps", {});
    highlightTimeStamps.clear();

    for (const [key, value] of Object.entries(data)) {
      highlightTimeStamps.set(key, value);
    }
  } catch (err) {
    console.error({
      errorMessage: "Failed to initialize the DB.",
      err,
    });
  }
}

async function persist(context) {
  try {
    const data = Object.fromEntries(highlightTimeStamps);
    await context.globalState.update("highlightTimeStamps", data);
  } catch (err) {
    console.error({
      errorMessage: "Failed to persist() timeStamp.",
      err,
    });
  }
}

// Schedules a single persist after a short delay, coalescing multiple rapid
// saveTimestamp calls (e.g. during a bulk file scan) into one globalState write.
function schedulePersist(context) {
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistDebounceTimer = null;
    persist(context);
  }, 300);
}

async function saveTimestamp(keyword, fileName = null, line = null, context) {
  try {
    const key = generateKeywordKey(keyword, fileName, line);
    if (!highlightTimeStamps.has(key)) {
      const currentTime = Date.now();
      highlightTimeStamps.set(key, currentTime);
      schedulePersist(context);
    }
  } catch (err) {
    console.error({
      errorMessage: "Failed to save() timestamp.",
      err,
    });
  }
}

async function deleteTimestamp(keyword, filePath, line, context) {
  try {
    const compositeKey = generateKeywordKey(keyword, filePath, line);
    if (highlightTimeStamps.has(compositeKey)) {
      highlightTimeStamps.delete(compositeKey);
      await persist(context);
    }
  } catch (err) {
    console.error({
      errorMessage: "Failed to Delete() timestamp.",
      err,
    });
  }
}

function getTimestamp(keyword, fileName, line) {
  return highlightTimeStamps.get(generateKeywordKey(keyword, fileName, line));
}

function getAllTimestamps() {
  return highlightTimeStamps;
}

module.exports = {
  initDB,
  saveTimestamp,
  deleteTimestamp,
  getTimestamp,
  getAllTimestamps,
  highlightTimeStamps,
};
