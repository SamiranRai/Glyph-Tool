// const { Level } = require("level");

// let db; // LevelDB instance

// // LEVELDB_ERROR: failed to delete DJDJ:: Error: Database is not open
// async function initDB(context, highlightTimeStamps) {
//   try {
//     const storagePath = context.globalStorageUri.fsPath;
//     console.log("storagePath:", storagePath);
//     db = new Level(`${storagePath}/timestamps-db`, { valueEncoding: "json" });

//     console.log(db);

//     console.log("DB Connect successfully..", db);
//     await loadTimestampsFromDB(highlightTimeStamps);
//   } catch (error) {
//     console.error("Failed to initialize LevelDB:", error);
//   }
// }

// async function saveTimestamp(keyword, highlightTimeStamps) {
//   if (!db || db.status !== "open") {
//     console.error(`Cannot save ${keyword}: DB not open`);
//     return;
//   }

//   const currentTime = Date.now();

//   try {
//     // Convert to Map if it's not already one
//     // if (!(highlightTimeStamps instanceof Map)) {
//     //   console.warn("highlightTimeStamps is not a Map. Converting...");
//     //   highlightTimeStamps = new Map(Object.entries(highlightTimeStamps));
//     // }

//     // console.log("Debug::levelDb", {
//     // type : typeof highlightTimeStamps,
//     // highlighttimestamps : highlightTimeStamps,
//     // });

//     const existingTime = highlightTimeStamps.get(keyword);
//     if (existingTime && existingTime === currentTime) return;

//     await db.put(keyword, currentTime);
//     highlightTimeStamps.set(keyword, currentTime);
//   } catch (error) {
//     console.error(`Error saving timestamp for ${keyword}:`, error);
//   }
// }

// async function deleteTimestamp(keyword, highlightTimeStamps) {
//   if (!db || db.status !== "open") {
//     console.error(`Cannot delete ${keyword}: DB not open`);
//     return;
//   }
//   try {
//     await db.del(keyword);
//     highlightTimeStamps.delete(keyword);
//   } catch (error) {
//     console.error(`Failed to delete ${keyword}:`, error);
//   }
// }

// async function loadTimestampsFromDB(highlightTimeStamps) {
//   try {
//     highlightTimeStamps.clear();

//     for await (const [key, value] of db.iterator()) {
//       highlightTimeStamps.set(key.toString(), value);
//     }

//     console.log(
//       "highlightTimeStampsLoadedfromDB:::",
//       JSON.stringify([...highlightTimeStamps])
//     );
//   } catch (error) {
//     console.error("Error loading data from LevelDB:", error);
//   }
// }

// module.exports = {
//   initDB,
//   saveTimestamp,
//   deleteTimestamp,
//   loadTimestampsFromDB,
// };

const fs = require("fs");
const path = require("path");
const os = require("os");

let dbPath;
let highlightTimeStampsRef;

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getSafeDBPath(context) {
  let basePath = context?.globalStorageUri?.fsPath;

  try {
    if (!basePath || !fs.existsSync(basePath)) {
      console.warn("globalStorageUri not usable, using fallback in home dir.");
      basePath = path.join(os.homedir(), ".myapp-timestamps-json");
    }
  } catch (e) {
    basePath = path.join(os.homedir(), ".myapp-timestamps-json");
  }

  ensureDirectoryExists(basePath);
  return path.join(basePath, "timestamps.json");
}

async function initDB(context, highlightTimeStamps) {
  dbPath = getSafeDBPath(context);
  highlightTimeStampsRef = highlightTimeStamps;

  try {
    if (fs.existsSync(dbPath)) {
      const raw = await fs.promises.readFile(dbPath, "utf-8");
      const data = JSON.parse(raw);
      highlightTimeStamps.clear();
      Object.entries(data).forEach(([key, value]) =>
        highlightTimeStamps.set(key, value)
      );
      console.log("Timestamps loaded from JSON:", data);
    } else {
      await persist(); // Create file if not exists
    }
  } catch (err) {
    console.error("Failed to initialize JSON DB:", err.message);
  }
}

async function saveTimestamp(keyword, highlightTimeStamps) {
  const currentTime = Date.now();

  const existingTime = highlightTimeStamps.get(keyword);
  if (existingTime && existingTime === currentTime) return;

  console.log("savedTimestamp:", keyword);
  highlightTimeStamps.set(keyword, currentTime);
  await persist();
}

async function deleteTimestamp(keyword, highlightTimeStamps) {
  console.log("deletedTimestamp:", keyword);
  highlightTimeStamps.delete(keyword);
  await persist();
}

async function loadTimestampsFromDB(highlightTimeStamps) {
  // This will just reload from the JSON file
  console.log("LoadTimestamp:", keyword);
  await initDB(null, highlightTimeStamps); // context not needed again
}

async function persist() {
  try {
    const dataObj = Object.fromEntries(highlightTimeStampsRef);
    await fs.promises.writeFile(
      dbPath,
      JSON.stringify(dataObj, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to persist timestamps to JSON:", err.message);
  }
}

module.exports = {
  initDB,
  saveTimestamp,
  deleteTimestamp,
  loadTimestampsFromDB,
};
