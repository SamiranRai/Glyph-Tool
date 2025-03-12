const generateColor = require("./../../shared/colorGenerator");

module.exports = (keyword) => {
  return {
    backgroundColor: generateColor(keyword),
  };
};
