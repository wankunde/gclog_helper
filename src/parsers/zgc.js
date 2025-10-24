const BaseParser = require('./base');
const { convertToKb, parseDuration } = require('../utils');

class ZGCParser extends BaseParser {
  constructor() {
    super();
  }

  parseGCEvent(line, timestamp, startTime) {
    let gcInfo = '';
    if (line.includes('Major Collection')) {
      gcInfo = line.substring(line.indexOf('Major Collection') + 'Major Collection'.length);
    } else if (line.includes('Minor Collection')) {
      gcInfo = line.substring(line.indexOf('Minor Collection') + 'Minor Collection'.length);
    } else {
      return null;
    }

    let gc_id = '', phase = '', reason = '', beforeVal = '', beforeUnit = '', afterVal = '', afterUnit = '', duration = '', timeUnit = '';

    const idMatch = line.match(/GC\((\d+)\)/);
    if (idMatch) {
      gc_id = idMatch[1];
    }

    const phaseMatch = line.match(/(Major|Minor)\s+Collection/);
    if (phaseMatch) {
      phase = phaseMatch[1];
    }

    const reasonMatch = line.match(/Collection\s+\((.*?)\)\s+\d+(K|M|G)/);
    if (reasonMatch) {
      reason = reasonMatch[1];
    }

    const memoryMatch = gcInfo.match(/(\d+)(K|M|G)\(\d+%\)->(\d+)(K|M|G)\(\d+%\)/);
    if (memoryMatch) {
      beforeVal = memoryMatch[1];
      beforeUnit = memoryMatch[2];
      afterVal = memoryMatch[3];
      afterUnit = memoryMatch[4];
    } else {
      return null; // Memory data is essential for ZGC events
    }

    const durationMatch = gcInfo.match(/(\d+\.\d+)(m?s)/);
    if (durationMatch) {
      duration = durationMatch[1];
      timeUnit = durationMatch[2];
    }

    return {
      timestamp: timestamp?.absolute || '',
      appTime: new Date(timestamp.absolute) - startTime,
      phase: phase ? `${phase} Collection` : '',
      reason: reason || '',
      beforeSize: beforeVal ? convertToKb(beforeVal, beforeUnit) : null,
      afterSize: afterVal ? convertToKb(afterVal, afterUnit) : null,
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
      if (timestamp.absolute && !startTime) {
          startTime = new Date(timestamp.absolute);
      }

      const event = this.parseGCEvent(line, timestamp, startTime);
      if (event) {
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
