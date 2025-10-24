// Main parser that delegates to specific GC parsers
const ZGCParser = require('./parsers/zgc');
const G1Parser = require('./parsers/g1');
const { convertToKb, isG1Log, isZGCLog } = require('./utils');

function detectGCType(lines) {
  if (typeof lines === 'string') {
    lines = lines.split(/\r?\n/);
  }
  if (isZGCLog(lines)) {
    return 'ZGC';
  }
  if (isG1Log(lines)) {
    return 'G1';
  }
  return 'Unknown';
}

function parse(content) {
  const lines = content.split(/\r?\n/);
  
  // First check for special patterns
  const usedMatch = content.match(/used=(\d+)([KMG])/);
  if (usedMatch) {
    const [_, value, unit] = usedMatch;
    return {
      absoluteLabels: [],
      relativeLabels: [],
      values: [convertToKb(value, unit)],
      collectorType: 'Unknown',
      events: []
    };
  }

  // Then try to detect GC type
  const gcType = detectGCType(lines);
  
  let parser;
  switch (gcType) {
    case 'ZGC':
      parser = new ZGCParser();
      break;
    case 'G1':
      parser = new G1Parser();
      break;
    default: // Unknown
      if (lines.some(line => line.includes('GC pause') || line.includes('Collection'))) {
        parser = new G1Parser();
      } else {
        throw new Error('Unsupported GC type');
      }
  }

  // Parse the content with appropriate parser
  const result = parser.parse(content);

  // Filter out lines without memory data if needed
  if (result.values.length === 0) {
    const memoryLines = lines.filter(line => 
      line.match(/\d+[KMG]/) && 
      (line.includes('Collection') || line.includes('GC pause'))
    );
    if (memoryLines.length > 0) {
      const memoryResult = parser.parse(memoryLines.join('\n'));
      // Keep timestamp information from original parse
      memoryResult.absoluteLabels = result.absoluteLabels;
      memoryResult.relativeLabels = result.relativeLabels;
      return memoryResult;
    }
  }

  return result;
}

module.exports = { parse, detectGCType };
