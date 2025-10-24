// Base parser class for all GC log parsers
class BaseParser {
  constructor() {
    this.absoluteTsRegexes = [
      /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})[+-]\d{4}\]:?/, // ISO with timezone and optional colon
      /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\]:?/, // ISO in brackets and optional colon
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})/, // ISO
      /\[timestamp: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\]:?/, // Explicit timestamp and optional colon
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}):/, // ISO with colon
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})$/ // Pure ISO without brackets
    ];

    this.relativeRegexes = [
      /^\[(\d+\.\d+)s\]/, // [0.123s]
      /^\[(\d+\.\d+)\]/, // [0.123]
      /^\[(\d+)\]/, // [123]
    ];
  }

  parseTimestamp(line) {
    if (!line || typeof line !== 'string') return null;

    // Try absolute time
    for (let regex of this.absoluteTsRegexes) {
      const m = line.match(regex);
      if (m) {
        try {
          const timestamp = new Date(m[1]);
          if (isNaN(timestamp.getTime())) continue;
          return {
            absolute: m[1],
            relative: null
          };
        } catch (e) {
          continue;
        }
      }
    }


    // Try relative time
    for (let regex of this.relativeRegexes) {
      const m = line.match(regex);
      if (m) {
        const relative = parseFloat(m[1]);
        if (!isNaN(relative)) {
          return {
            absolute: null,
            relative: relative.toFixed(3)
          };
        }
      }
    }

    return null;
  }

  // To be implemented by specific GC parsers
  parseMemoryInfo(line) {
    throw new Error('parseMemoryInfo must be implemented by specific GC parser');
  }

  // To be implemented by specific GC parsers
  parseGCEvent(line, timestamp) {
    throw new Error('parseGCEvent must be implemented by specific GC parser');
  }
}

module.exports = BaseParser;
