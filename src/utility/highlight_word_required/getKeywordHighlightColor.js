const tinycolor = require("tinycolor2");

// Function to generate colors dynamically for custom keywords
module.exports = (keyword) => {
  // Step 1: Generate a numeric hash from the keyword
  const hash = keyword
    .split("")
    .reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7);

  // Step 2: Map the hash to a refined color space for a premium look
  const hue = hash % 360; // Keeps hue in valid range (0-360 degrees)
  const saturation = 70 + (hash % 20); // Ensures rich and vibrant colors (70-90%)
  let lightness = 45 + (hash % 10); // Keeps balance between light & dark themes (45-55%)

  // **Step 3: Ensure even better readability**
  if (hue >= 30 && hue <= 60) lightness -= 5; // Adjust yellows to prevent over-brightness
  if (hue >= 0 && hue <= 30) lightness += 5; // Make reds more readable
  if (hue >= 180 && hue <= 300) lightness += 5; // Enhance blues/purples for clarity

  let backgroundColor = tinycolor(`hsl(${hue}, ${saturation}%, ${lightness}%)`);

  // Step 4: Return final colors (White text is always used)
  return {
    backgroundColor: backgroundColor.toHexString(),
  };
};
