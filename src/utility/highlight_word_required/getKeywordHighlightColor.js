const generateColor = require("./../../shared/colorGenerator");

/**
 * Returns the highlight style object for a given keyword.
 * The background color is generated deterministically from the keyword string.
 *
 * @param {string} keyword  Keyword string used to derive the color.
 * @returns {{ backgroundColor: string }}
 */
module.exports = (keyword) => {
  return {
    backgroundColor: generateColor(keyword),
  };
};
