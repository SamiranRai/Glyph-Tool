const { generateKeywordKey } = require('./../utility/db_required/keyGenerator');

// In-memory store of keyword timestamps, keyed by a canonical compound key
// (<KEYWORD>|<fileName>|<line>).  Loaded from VS Code globalState on startup.
let highlightTimeStamps = new Map();

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialises the in-memory timestamp store from VS Code's persisted
 * globalState.  Must be called once during extension activation before any
 * other DB functions are used.
 * @param {import('vscode').ExtensionContext} context
 */
async function initDB(context) {
  try {
    const data = await context.globalState.get("highlightTimeStamps", {});
    highlightTimeStamps.clear();
    for (const [key, value] of Object.entries(data)) {
      highlightTimeStamps.set(key, value);
    }
  } catch (err) {
    console.error({ errorMessage: "Failed to initialize the DB.", err });
  }
}

/**
 * Reloads all timestamps from globalState into the in-memory store.
 * Useful when the store may be out of sync with the persisted data.
 * @param {import('vscode').ExtensionContext} context
 */
async function loadAllTimestampsToMemory(context) {
  const stored = (await context.globalState.get("highlightTimeStamps")) || {};
  highlightTimeStamps.clear();
  for (const [key, value] of Object.entries(stored)) {
    highlightTimeStamps.set(key, value);
  }
}

// ---------------------------------------------------------------------------
// Persistence helper
// ---------------------------------------------------------------------------

/**
 * Writes the current in-memory timestamp map to VS Code's globalState.
 * @param {import('vscode').ExtensionContext} context
 */
async function persist(context) {
  try {
    const data = Object.fromEntries(highlightTimeStamps);
    await context.globalState.update("highlightTimeStamps", data);
  } catch (err) {
    console.error({ errorMessage: "Failed to persist() timeStamp.", err });
  }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Saves a timestamp for the given keyword location if one does not already
 * exist.  Existing timestamps are intentionally preserved so that the original
 * discovery time is never overwritten.
 * @param {string} keyword    Uppercase keyword with trailing colon (e.g. "TODO:").
 * @param {string|null} fileName  Source file name or path.
 * @param {number|null} line      1-based line number.
 * @param {import('vscode').ExtensionContext} context
 */
async function saveTimestamp(keyword, fileName = null, line = null, context) {
  try {
    const key = generateKeywordKey(keyword, fileName, line);
    if (!highlightTimeStamps.has(key)) {
      highlightTimeStamps.set(key, Date.now());
      await persist(context);
    }
  } catch (err) {
    console.error({ errorMessage: "Failed to save() timestamp.", err });
  }
}

/**
 * Deletes the timestamp for the given keyword location.
 * @param {string} keyword
 * @param {string} filePath
 * @param {number} line
 * @param {import('vscode').ExtensionContext} context
 */
async function deleteTimestamp(keyword, filePath, line, context) {
  try {
    const key = generateKeywordKey(keyword, filePath, line);
    if (highlightTimeStamps.has(key)) {
      highlightTimeStamps.delete(key);
      await persist(context);
    }
  } catch (err) {
    console.error({ errorMessage: "Failed to Delete() timestamp.", err });
  }
}

/**
 * Returns the stored timestamp (ms since epoch) for the given keyword location,
 * or `undefined` if not found.
 * @param {string} keyword
 * @param {string} fileName
 * @param {number} line
 * @returns {number|undefined}
 */
function getTimestamp(keyword, fileName, line) {
  return highlightTimeStamps.get(generateKeywordKey(keyword, fileName, line));
}

/**
 * Returns the full in-memory timestamp map (read-only by convention).
 * @returns {Map<string, number>}
 */
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
  loadAllTimestampsToMemory,
};
