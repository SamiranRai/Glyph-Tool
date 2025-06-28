function generateKeywordKey (keyword, fileName, line) {
    return `${keyword.toUpperCase()}|${fileName}|${line}`; // already includes ':' in calling code
}

module.exports = {generateKeywordKey};