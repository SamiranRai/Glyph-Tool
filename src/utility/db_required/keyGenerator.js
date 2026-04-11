/**
 * Generates a canonical compound key used to identify a specific keyword
 * occurrence in a specific file and line.
 *
 * Format: `<KEYWORD>|<fileName>|<line>`
 *
 * @param {string} keyword   Keyword string (will be uppercased).
 * @param {string} fileName  File name or path.
 * @param {number} line      Line number.
 * @returns {string}
 */
function generateKeywordKey(keyword, fileName, line) {
  return `${keyword.toUpperCase()}|${fileName}|${line}`;
}

module.exports = { generateKeywordKey };