// Main parser that delegates to specific GC parsers
const ZGCParser = require('./parsers/zgc');
const G1Parser = require('./parsers/g1');
const { convertToKb } = require('./utils');

/**
 * Detects the garbage collector (GC) type from the log lines.
 * @param {String[]} lines 
 * @returns {String} GC type: 'ZGC', 'G1', or 'G1' as default
 */
function detectGCType(lines) {
  if (typeof lines === 'string') {
    lines = lines.split(/\r?\n/);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('The Z Garbage Collector')) {
      return 'ZGC';
    }
    if (line.toLowerCase().includes('using g1')) {
      return 'G1';
    }
    if (line.includes('G1 Young Generation') ||
      line.includes('G1 Mixed Generation') ||
      line.includes('GC pause (G1')) {
      return 'G1';
    }

    if (line.includes('Major Collection') ||
      line.includes('Minor Collection')) {
      return 'ZGC';
    }
  }

  return 'G1';
}

function parse(content) {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      startTime: null,
      collectorType: 'Unknown',
      events: []
    };
  }

  const lines = content.split(/\r?\n/);
  const gcType = detectGCType(lines);

  console.log('Detected GC Type:', gcType);
  let parser;
  switch (gcType) {
    case 'ZGC':
      parser = new ZGCParser();
      break;
    case 'G1':
      parser = new G1Parser();
      break;
    default:
      throw new Error('Unsupported GC type');
  }

  // Parse the content with appropriate parser
  const result = parser.parse(content);

  // Filter out lines without events if needed
  if (result.events.length === 0) {
    const gcLines = lines.filter(line =>
      line.match(/\d+[KMG]/) &&
      (line.includes('Collection') || line.includes('GC pause'))
    );
    if (gcLines.length > 0) {
      return parser.parse(gcLines.join('\n'));
    }
  }

  return result;
}

module.exports = { parse, detectGCType };
