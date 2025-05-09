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

const removeKeyword = async (keyword) => {
  // Wait for keywords to load
  const keywords = await loadKeywords();
  const index = keywords.findIndex((k) => k.keyword === keyword);
  if (index !== -1) {
    keywords.splice(index, 1); // Remove the keyword directly
    await saveKeywords(keywords); // Update the storage
  }
};

// Update a keyword color
const updateKeyword = (keyword, newColor) => {
  const keywords = loadKeywords().map((k) =>
    k.keyword === keyword ? { ...k, color: newColor } : k
  );
  saveKeywords(keywords);
};

module.exports = { loadKeywords, addKeyword, removeKeyword, updateKeyword };
