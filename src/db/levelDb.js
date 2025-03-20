const { Level } = require("level");

let db; // LevelDB instance

async function initDB(context, highlightTimeStamps) {
  try {
    const storagePath = context.globalStorageUri.fsPath;
    db = new Level(`${storagePath}/timestamps-db`, { valueEncoding: "json" });

    await loadTimestampsFromDB(highlightTimeStamps);
  } catch (error) {
    console.error("Failed to initialize LevelDB:", error);
  }
}

async function saveTimestamp(keyword, highlightTimeStamps) {
  if (!db) {
    console.error("LevelDB is not initialized. Cannot save.");
    return;
  }

  const currentTime = Date.now();

  try {
    // Convert to Map if it's not already one
    // if (!(highlightTimeStamps instanceof Map)) {
    //   console.warn("highlightTimeStamps is not a Map. Converting...");
    //   highlightTimeStamps = new Map(Object.entries(highlightTimeStamps));
    // }

    // console.log("Debug::levelDb", {
    //   type: typeof highlightTimeStamps,
    //   highlightTimeStamps: highlightTimeStamps,
    // });

    const existingTime = highlightTimeStamps.get(keyword);
    if (existingTime && existingTime === currentTime) return;

    await db.put(keyword, currentTime);
    highlightTimeStamps.set(keyword, currentTime);
  } catch (error) {
    console.error(`Error saving timestamp for ${keyword}:`, error);
  }
}

async function deleteTimestamp(keyword, highlightTimeStamps) {
  if (!db) return;
  try {
    await db.del(keyword);
    highlightTimeStamps.delete(keyword);
  } catch (error) {
    console.error(`Failed to delete ${keyword}:`, error);
  }
}

async function loadTimestampsFromDB(highlightTimeStamps) {
  try {
    highlightTimeStamps.clear();

    for await (const [key, value] of db.iterator()) {
      highlightTimeStamps.set(key.toString(), value);
    }

    console.log(
      "highlightTimeStampsLoadedfromDB:::",
      JSON.stringify([...highlightTimeStamps])
    );
  } catch (error) {
    console.error("Error loading data from LevelDB:", error);
  }
}

module.exports = {
  initDB,
  saveTimestamp,
  deleteTimestamp,
  loadTimestampsFromDB,
};
