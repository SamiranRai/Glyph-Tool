function generateKeywordKey(keyword, fileName, line) {
	return `${keyword.toUpperCase()}|${fileName}|${line}`;
}

module.exports = { generateKeywordKey };
