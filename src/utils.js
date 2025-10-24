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
 * Generate a random color from the predefined color palette
 * @returns {string} A hex color code
 */
function getRandomColor() {
  const colors = [
    '#4dc9f6', '#f67019', '#f53794', '#537bc4',
    '#acc236', '#166a8f', '#00a950', '#58595b'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Check if the log lines are from G1 GC
 * @param {string[]|string} lines Array of log lines or a string to check
 * @returns {boolean} True if the lines are from G1 GC
 */
function isG1Log(lines) {
  if (typeof lines === 'string') {
    lines = lines.split(/\r?\n/);
  }
  return lines.some(line => 
    line.toLowerCase().includes('using g1') || 
    line.includes('G1 Young Generation') || 
    line.includes('G1 Mixed Generation') ||
    line.includes('GC pause (G1')
  );
}

/**
 * Check if the log lines are from ZGC
 * @param {string[]|string} lines Array of log lines or a string to check
 * @returns {boolean} True if the lines are from ZGC
 */
function isZGCLog(lines) {
  if (typeof lines === 'string') {
    lines = lines.split(/\r?\n/);
  }
  return lines.some(line => 
    line.toLowerCase().includes('using zgc') ||
    line.includes('gc,init] ZGC') ||
    line.includes('Major Collection') ||
    line.includes('Minor Collection')
  );
}

module.exports = {
  convertToKb,
  formatMemorySize,
  getRandomColor,
  isG1Log,
  isZGCLog
};
