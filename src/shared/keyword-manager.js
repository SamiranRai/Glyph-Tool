const fs = require("fs");
const path = require("path");

const keywordsFile = path.join(__dirname, "predefined-keywords.js");

function loadKeywords() {
  delete require.cache[require.resolve(keywordsFile)];
  return require(keywordsFile);
}

function saveKeywords(keywords) {
  fs.writeFileSync(
    keywordsFile,
    `module.exports = ${JSON.stringify(keywords, null, 2)};`,
    "utf8"
  );
}

async function addKeyword(keyword, color) {
  const keywords = loadKeywords();
  if (!keywords.some((item) => item.keyword === keyword)) {
    keywords.push({ keyword, color });
    saveKeywords(keywords);
  }
}

async function removeKeyword(keyword) {
  const keywords = loadKeywords();
  const index = keywords.findIndex((item) => item.keyword === keyword);
  if (index !== -1) {
    keywords.splice(index, 1);
    saveKeywords(keywords);
  }
}

function updateKeyword(keyword, newColor) {
  const keywords = loadKeywords().map((item) =>
    item.keyword === keyword ? { ...item, color: newColor } : item
  );
  saveKeywords(keywords);
}

module.exports = { loadKeywords, addKeyword, removeKeyword, updateKeyword };
