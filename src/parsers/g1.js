const BaseParser = require('./base');
const { convertToKb, parseDuration } = require('../utils');

class G1Parser extends BaseParser {
  constructor() {
    super();
  }

  parseGCEvent(line, timestamp, startTime) {
    let phase = '', duration = null;
    let beforeSize = null, afterSize = null;
    let reason = '';

    // Determine phase based on line content
    if (line.includes('Young Generation') || line.match(/GC pause.*Young/)) {
      phase = 'Young GC';
    } else if (line.includes('Mixed Generation') || line.match(/GC pause.*Mixed/)) {
      phase = 'Mixed GC';
    } else if (line.includes('Full GC')) {
      phase = 'Full GC';
    } else {
      return null;
    }

    console.log('Determined phase:', phase);
    // Extract duration if available
    const durationMatch = line.match(/(\d+\.\d+)\s*(m?s)/);
    if (durationMatch) {
      duration = parseDuration(durationMatch[0]);
    }
    console.log('Extracted duration:', duration);

    // Extract memory changes
    const memoryMatch = line.match(/(\d+)([KMG])->(\d+)([KMG])/i);
    if (memoryMatch) {
      beforeSize = convertToKb(memoryMatch[1], memoryMatch[2]);
      afterSize = convertToKb(memoryMatch[3], memoryMatch[4]);
    } else {
      return null; // Memory data is essential for G1 events
    }

    console.log('Extracted memory sizes:', { beforeSize, afterSize });
    // Extract reason if available
    const reasonMatch = line.match(/\(([^)]+)\)/);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
    }

    console.log('Extracted reason:', reason);
    return {
      timestamp: timestamp?.absolute || '',
      appTime: new Date(timestamp.absolute) - startTime,
      phase,
      reason,
      duration,
      beforeSize,
      afterSize
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
      collectorType: 'G1',
      events
    };
  }
}

module.exports = G1Parser;
