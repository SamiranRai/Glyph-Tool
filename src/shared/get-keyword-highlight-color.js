const generateColor = require("./color-generator");

module.exports = (keyword) => ({
  backgroundColor: generateColor(keyword),
});
