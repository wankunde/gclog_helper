// Utility functions for GC Log Helper

/**
 * Convert memory value to KB
 * @param {number|string} value The memory value
 * @param {string} unit The unit (K, M, or G)
 * @returns {number} The value in KB
 */
function convertToKb(value, unit) {
  switch(unit.toUpperCase()) {
    case 'K': return parseInt(value);
    case 'M': return parseInt(value) * 1024;
    case 'G': return parseInt(value) * 1024 * 1024;
    default: return parseInt(value);
  }
}

/**
 * Format memory size to human readable string
 * @param {number} value Value in KB
 * @returns {string} Formatted string with appropriate unit
 */
function formatMemorySize(value) {
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' GB';
  if (value >= 1024) return (value / 1024).toFixed(2) + ' MB';
  return value + ' KB';
}

/**
 * Parse duration string to milliseconds
 * @param {string} duration Duration string (e.g., "15.123ms" or "1.5s")
 * @returns {number|null} Duration in milliseconds, or null if invalid format
 */
function parseDuration(duration) {
  if (!duration) return null;
  
  const match = duration.match(/(\d+\.\d+)\s*(m?s)/);
  if (!match) return null;

  const [, value, unit] = match;
  const numValue = parseFloat(value);
  
  return unit === 's' ? numValue * 1000 : numValue;
}

module.exports = {
  convertToKb,
  formatMemorySize,
  parseDuration
};
