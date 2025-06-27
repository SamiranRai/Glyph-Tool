let highlightTimeStamps = new Map();

function normalizeKey(keyword) {
  return keyword.toUpperCase(); // already includes ':' in calling code
}

async function initDB(context) {
  try {
    const data = await context.globalState.get("highlightTimeStamps", {});
    highlightTimeStamps.clear();

    for (const [key, value] of Object.entries(data)) {
      highlightTimeStamps.set(normalizeKey(key), value);
    }

    console.log("Timestamps successfully loaded from global-state.");
  } catch (err) {
    console.error({
      errorMessage: "Failed to initialize the DB.",
      err,
    });
  }
}

async function loadAllTimestampsToMemory(context) {
  const stored = (await context.globalState.get("highlightTimeStamps")) || {};
  highlightTimeStamps.clear(); // Ensure clean slate
  for (const [key, value] of Object.entries(stored)) {
    highlightTimeStamps.set(key, value);
  }
}

async function persist(context) {
  try {
    if (!context?.globalState?.update) {
      throw new Error("Invalid extension context: missing globalState.update()");
    }
    const data = Object.fromEntries(highlightTimeStamps);
    console.log("Persisting Timestamps: ", data);
    await context.globalState.update("highlightTimeStamps", data);
  } catch (err) {
    console.error({
      errorMessage: "Failed to persist() timeStamp.",
      err,
    });
  }
}


async function saveTimestamp(keyword, context) {
  try {
    const key = normalizeKey(keyword);
    if (!highlightTimeStamps.has(key)) {
      const currentTime = Date.now();
      highlightTimeStamps.set(key, currentTime);
      console.log("Saved timestamp for:", key);
      await persist(context);
    } else {
      console.log("⏱️ Existing timestamp preserved for:", key);
    }
  } catch (err) {
    console.error({
      errorMessage: "Failed to save() timestamp.",
      err,
    });
  }
}

async function deleteTimestamp(keyword, context) {
  try {
    const key = normalizeKey(keyword);
    if (highlightTimeStamps.has(key)) {
      highlightTimeStamps.delete(key);
      console.log("Deleted timestamp for:", key);
      await persist(context);
    }
  } catch (err) {
    console.error({
      errorMessage: "Failed to Delete() timestamp.",
      err,
    });
  }
}

function getTimestamp(keyword) {
  return highlightTimeStamps.get(normalizeKey(keyword));
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
  loadAllTimestampsToMemory
};

// async function initDB(context, highlightTimeStamps) {
//   try {
//     const data = context.globalState.get("highlightTimeStamps", {});
//     highlightTimeStamps.clear();
//     Object.entries(data).forEach(([key, value]) =>
//       highlightTimeStamps.set(key, value)
//     );
//     console.log({
//       context,
//       highlightTimeStamps
//     })
//     console.log("Timestamps successfully loaded from global-state.");
//   } catch (err) {
//     console.error({
//       ERRORMESSAGE: "Failed to load timestamps from global-state!",
//       err,
//     });
//   }
// }

// async function saveTimestamp(keyword, highlightTimeStamps, context) {
//   const currentTime = Date.now();
//   try {
//     const existingTime = highlightTimeStamps.get(keyword);
//     if (existingTime && existingTime === currentTime) return;

//     console.log("Saved timestamp for:", keyword);
//     highlightTimeStamps.set(keyword, currentTime);
//     await persist(context, highlightTimeStamps);
//   } catch (err) {
//     console.error({
//       ERRORMESSAGE: "Failed to save timestamp to global-state!",
//       err,
//     });
//   }
// }

// async function deleteTimestamp(keyword, highlightTimeStamps, context) {
//   try {
//     console.log(`Successfully deleted timestamp for ${keyword}.`);
//     highlightTimeStamps.delete(keyword);
//     await persist(context, highlightTimeStamps);
//   } catch (err) {
//     console.error({
//       ERRORMESSAGE: "Failed to delete timestamp from global-state!",
//       err,
//     });
//   }
// }

// async function loadTimestampsFromDB(context) {
//   const globalState = context.globalState;
//   const saved = globalState.get("highlightTimeStamps");

//   if (saved) {
//     for (const [key, value] of Object.entries(saved)) {
//       highlightTimeStamps.set(key, value);
//     }
//   } else {
//     console.log("No saved timestamps found in globalState.");
//   }
// }

// async function persist(context, highlighttimestamps) {
//   try {
//     // if (!context || !context.globalState || !context.globalState.update) {
//     //   throw new Error("❌ Missing or invalid extension context or globalState!");
//     // }
//     console.log("🧪 Context during persist():", {
//       CONTEXTEXISTS: !!context,
//       GLOBALSTATEEXISTS: !!context?.globalState,
//       UPDATEEXISTS: typeof context?.globalState?.update === "function",
//     });
//     const data = Object.fromEntries(highlighttimestamps);
//     await context.globalState.update("highlightTimeStamps", data);
//   } catch (err) {
//     console.error({
//       ERRORMESSAGE: "Failed to save to global-state!",
//       err,
//     });
//   }
// }

// module.exports = {
//   initDB,
//   saveTimestamp,
//   deleteTimestamp,
//   loadTimestampsFromDB,
// };
