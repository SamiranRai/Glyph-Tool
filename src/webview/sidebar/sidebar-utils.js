/* eslint-env browser */
/* global window */

(function (global) {
  function sanitizeInput(inputData) {
    return inputData
      .trim()
      .replace(/[:\-]+$/, "")
      .replace(/\s+/g, "_");
  }

  function timeAgo(timeStamp) {
    if (!timeStamp || Number.isNaN(timeStamp)) return "Invalid timestamp";

    const now = Date.now();
    if (timeStamp > now) return "In the future";

    const diff = Math.floor((now - timeStamp) / 1000);
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

  function filterTasksBySearch(data, searchTerm) {
    if (!Array.isArray(data)) return [];

    return data.filter((item) => {
      return (
        item.description?.toLowerCase().includes(searchTerm) ||
        item.keyword?.toLowerCase().includes(searchTerm) ||
        item.file?.toLowerCase().includes(searchTerm)
      );
    });
  }

  function sortDataByTime(data) {
    return data.sort((a, b) => b.timeStamp - a.timeStamp);
  }

  function sortDataByKeywordLength(data) {
    return data.sort(
      (a, b) => (a.keyword || "").length - (b.keyword || "").length
    );
  }

  function sortDataByAlphabetically(data) {
    return data.slice().sort((a, b) => {
      const keywordA = a.keyword?.toLowerCase() || "";
      const keywordB = b.keyword?.toLowerCase() || "";
      return keywordA.localeCompare(keywordB);
    });
  }

  function extractOriginalKeyword(description) {
    if (typeof description !== "string") return "UNKNOWN";
    const match = description.match(/"(\w+?)"/);
    return match ? match[1].toUpperCase() : "UNKNOWN";
  }

  function extractTimeFromDescription(description) {
    if (typeof description !== "string") return 0;
    const match = description.match(/\|\s*(\d{13})\]/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function groupData(data) {
    const groupByFileAndKeyword = {};
    const groupByKeyword = {};

    data.forEach((item) => {
      const file = item.file;
      const keyword = item.keyword;

      if (!groupByFileAndKeyword[file]) {
        groupByFileAndKeyword[file] = {};
      }
      if (!groupByFileAndKeyword[file][keyword]) {
        groupByFileAndKeyword[file][keyword] = [];
      }
      groupByFileAndKeyword[file][keyword].push(item);

      if (!groupByKeyword[keyword]) {
        groupByKeyword[keyword] = [];
      }
      groupByKeyword[keyword].push(item);
    });

    return [groupByKeyword, groupByFileAndKeyword];
  }

  function parseDoneDescription(item) {
    const description = item?.description || "";

    const taskMatch = description.match(/^"([^"]+)"/);
    const taskKeyword = taskMatch ? taskMatch[1] : "Unknown Task";

    const timestampMatch = description.match(/\[(\d{2} \w{3} \d{4}) \| (\d+)\]/);
    const createdTimeStamp = timestampMatch ? timestampMatch[2] : "Unknown Timestamp";

    const descMatch = description.match(
      /^"[^"]+"\s*-\s*((?:.|\n)*?)\s*\[[^\]]*\]\s*$/
    );
    const detailDescription = descMatch && descMatch[1]
      ? descMatch[1].trim()
      : "No description available";

    return {
      taskKeyword,
      createdTimeStamp,
      detailDescription,
    };
  }

  function isSidebarDataEmpty(data) {
    return (
      !data ||
      data.length === 0 ||
      data.every((obj) => {
        const rest = Object.fromEntries(
          Object.entries(obj).filter(([key]) => key !== "preDefinedKeywords")
        );

        return (
          Object.keys(rest).length === 0 ||
          Object.values(rest).every(
            (val) =>
              val === null ||
              val === undefined ||
              (Array.isArray(val) && val.length === 0) ||
              val === ""
          )
        );
      })
    );
  }

  global.sidebarUtils = {
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
  };
})(window);