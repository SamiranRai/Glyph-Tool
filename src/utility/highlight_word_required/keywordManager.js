const fs = require("fs");
const path = require("path");

const keywordsFile = path.join(__dirname, "preDefinedKeywords.js");

/**
 * Loads the current list of predefined keywords from disk, bypassing the
 * module cache so that in-extension edits are always reflected.
 * @returns {Array<{ keyword: string, color: string }>}
 */
const loadKeywords = () => {
  delete require.cache[require.resolve(keywordsFile)];
  return require(keywordsFile);
};

/**
 * Serialises the given keyword array back to `preDefinedKeywords.js`.
 * @param {Array<{ keyword: string, color: string }>} keywords
 */
const saveKeywords = (keywords) => {
  fs.writeFileSync(
    keywordsFile,
    `module.exports = ${JSON.stringify(keywords, null, 2)};`,
    "utf8"
  );
};

/**
 * Adds a new keyword with the given color if it does not already exist.
 * @param {string} keyword
 * @param {string} color  Hex color string (e.g. "#ff6347").
 */
const addKeyword = async (keyword, color) => {
  const keywords = await loadKeywords();
  if (!keywords.some((k) => k.keyword === keyword)) {
    keywords.push({ keyword, color });
    saveKeywords(keywords);
  }
};

/**
 * Removes a keyword by name.  No-op if the keyword is not found.
 * @param {string} keyword
 */
const removeKeyword = async (keyword) => {
  const keywords = await loadKeywords();
  const index = keywords.findIndex((k) => k.keyword === keyword);
  if (index !== -1) {
    keywords.splice(index, 1);
    saveKeywords(keywords);
  }
};

/**
 * Updates the color of an existing keyword.  No-op if the keyword is not found.
 * @param {string} keyword
 * @param {string} newColor
 */
const updateKeyword = (keyword, newColor) => {
  const keywords = loadKeywords().map((k) =>
    k.keyword === keyword ? { ...k, color: newColor } : k
  );
  saveKeywords(keywords);
};

module.exports = { loadKeywords, addKeyword, removeKeyword, updateKeyword };
