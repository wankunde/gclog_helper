const BaseParser = require('./base');
const { convertToKb, parseDuration } = require('../utils');

class ZGCParser extends BaseParser {
  constructor() {
    super();
  }

  parseGCEvent(line, timestamp) {
    // Match GC event line with or without duration
    const eventMatch = line.match(/GC\((\d+)\)\s+(Major|Minor)\s+Collection\s+\((.*?)\)\s+(\d+)(K|M|G)(?:\(\d+%\))?->(\d+)(K|M|G)(?:\(\d+%\))?(?:\s+(\d+\.\d+)(m?s))?/);
    if (!eventMatch) return null;

    const [, gc_id, phase, reason, beforeVal, beforeUnit, afterVal, afterUnit, duration, timeUnit] = eventMatch;
    
    return {
      timestamp: timestamp?.absolute || '',
      phase: `${phase} Collection`,
      reason,
      beforeSize: convertToKb(beforeVal, beforeUnit),
      afterSize: convertToKb(afterVal, afterUnit),
      duration: duration ? parseDuration(`${duration}${timeUnit}`) : null
    };
  }

  parse(content) {
    const lines = content.split(/\r?\n/);
    const events = [];
    let startTime = null;

    for (const line of lines) {
      if (!line || line.trim().length === 0) continue;

      const timestamp = this.parseTimestamp(line);
      if (!timestamp) continue;

      const event = this.parseGCEvent(line, timestamp);
      if (event) {
        if (timestamp.absolute && !startTime) {
          startTime = new Date(timestamp.absolute);
        }
        events.push(event);
      }
    }

    return {
      startTime: startTime ? startTime.toISOString() : null,
      collectorType: 'ZGC',
      events: events
    };
  }
}

module.exports = ZGCParser;
