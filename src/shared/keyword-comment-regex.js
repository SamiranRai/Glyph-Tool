const { escapeRegexLiteral } = require("./comment-utils");

function createHighlightKeywordRegex(commentPrefix) {
  return new RegExp(
    `^[ \\t]*${escapeRegexLiteral(commentPrefix)}[ \\t]*@([a-zA-Z_][a-zA-Z0-9_]*)[:][^\\n]*$`,
    "gm"
  );
}

function createScanKeywordRegex(commentSymbol) {
  if (commentSymbol === ";") {
    return new RegExp(
      `^\\s*${escapeRegexLiteral(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
      "gm"
    );
  }

  if (commentSymbol === "#") {
    return new RegExp(`^\\s*#\\s*@([A-Z_]+):\\s*(.*)`, "gm");
  }

  return new RegExp(
    `^\\s*${escapeRegexLiteral(commentSymbol)}\\s*@([A-Z_]+):\\s*(.*)`,
    "gm"
  );
}

module.exports = {
  createHighlightKeywordRegex,
  createScanKeywordRegex,
};
