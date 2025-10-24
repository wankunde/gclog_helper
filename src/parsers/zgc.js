const BaseParser = require('./base');
const { convertToKb } = require('../utils');

class ZGCParser extends BaseParser {
  constructor() {
    super();
    this.memoryPatterns = [
      {
        // ZGC collection pattern with unit support
        regex: /GC\(\d+\)\s+(?:Major|Minor)\s+Collection\s+\([^)]+\)\s+(\d+)(K|M|G)\s*\(\d+%\)->(\d+)(K|M|G)\s*\(\d+%\)/,
        getValue: matches => {
          // Return both before and after values
          const beforeValue = convertToKb(matches[1], matches[2]);
          const afterValue = convertToKb(matches[3], matches[4]);
          return afterValue; // We return the after value as that's what we're interested in
        }
      },
      {
        // Basic heap usage pattern
        regex: /(?:heap|used)\s*[:=]\s*(\d+)(K|M|G)\s*(?:\(.*?\))?/i,
        getValue: matches => convertToKb(matches[1], matches[2])
      },
      {
        // Simple size pattern
        regex: /size:\s*(\d+)(K|M|G)/i,
        getValue: matches => convertToKb(matches[1], matches[2])
      }
    ];
  }

  parseMemoryInfo(line) {
    for (const pattern of this.memoryPatterns) {
      const matches = line.match(pattern.regex);
      if (matches) {
        return pattern.getValue(matches);
      }
    }
    return null;
  }

  parseGCEvent(line, timestamp) {
    // Match GC event line with or without duration
    const eventMatch = line.match(/GC\((\d+)\)\s+(Major|Minor)\s+Collection\s+\((.*?)\)\s+(\d+)(K|M|G)(?:\(\d+%\))?->(\d+)(K|M|G)(?:\(\d+%\))?(?:\s+(\d+\.\d+)s)?/);
    if (!eventMatch) return null;

    const [, gc_id, phase, details, beforeVal, beforeUnit, afterVal, afterUnit, duration] = eventMatch;
    
    return {
      timestamp: timestamp?.absolute || '',
      phase: `${phase} Collection`,
      details: details,
      beforeSize: convertToKb(beforeVal, beforeUnit),
      afterSize: convertToKb(afterVal, afterUnit),
      duration: duration ? parseFloat(duration) * 1000 : null // Convert seconds to milliseconds if available
    };
  }



  parse(content) {
    const lines = content.split(/\r?\n/);
    const context = {
      absoluteLabels: [],
      relativeLabels: [],
      values: [],
      startTime: null,
      events: []
    };

    for (const line of lines) {
      console.log(`begin new line, values: ${context.values.length}, events: ${context.events.length}`);
      if (!line || line.trim().length === 0) continue;

      const timestamp = this.parseTimestamp(line, context);
      if (!timestamp) continue;
      console.log(`parsed timestamp: absolute=${timestamp.absolute}, relative=${timestamp.relative}`);

      const memoryValue = this.parseMemoryInfo(line);
      if (memoryValue === null || isNaN(memoryValue)) continue;
      console.log(`parsed memory value: ${memoryValue} KB`);

      if (timestamp.absolute) context.absoluteLabels.push(timestamp.absolute);
      context.relativeLabels.push(timestamp.relative);
      context.values.push(memoryValue);

      const event = this.parseGCEvent(line, timestamp);
      if (event) {
        context.events.push(event);
      }
    }

    
    return {
      absoluteLabels: context.absoluteLabels,
      relativeLabels: context.relativeLabels,
      values: context.values,
      startTime: context.startTime ? context.startTime.toISOString() : null,
      collectorType: 'ZGC',
      events: context.events
    };
  }
}

module.exports = ZGCParser;
