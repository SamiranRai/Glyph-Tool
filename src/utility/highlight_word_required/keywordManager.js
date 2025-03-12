const fs = require("fs");
const path = require("path");

const keywordsFile = path.join(__dirname, "predefinedKeywords.js");

// Load current keywords
const loadKeywords = () => require(keywordsFile);

// Save new keywords to the file
const saveKeywords = (keywords) => {
  fs.writeFileSync(
    keywordsFile,
    `module.exports = ${JSON.stringify(keywords, null, 2)};`,
    "utf8"
  );
};

// Add a new keyword
const addKeyword = (keyword, color) => {
  const keywords = loadKeywords();
  if (!keywords.some((k) => k.keyword === keyword)) {
    keywords.push({ keyword, color });
    saveKeywords(keywords);
  }
};

// Remove a keyword
const removeKeyword = (keyword) => {
  const keywords = loadKeywords().filter((k) => k.keyword !== keyword);
  saveKeywords(keywords);
};

// Update a keyword color
const updateKeyword = (keyword, newColor) => {
  const keywords = loadKeywords().map((k) =>
    k.keyword === keyword ? { ...k, color: newColor } : k
  );
  saveKeywords(keywords);
};

module.exports = { loadKeywords, addKeyword, removeKeyword, updateKeyword };
