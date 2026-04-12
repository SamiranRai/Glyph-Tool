const path = require("path");

function getFileExtension(fileName) {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

function getCommentSymbolForFile(fileName, commentStyles, fallback = null) {
  const extension = getFileExtension(fileName);
  return commentStyles[extension] || fallback;
}

function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getCommentSymbolForFile,
  escapeRegexLiteral,
};
