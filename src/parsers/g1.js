const BaseParser = require('./base');
const { convertToKb } = require('../utils');

class G1Parser extends BaseParser {
  constructor() {
    super();
    this.memoryPatterns = [
      {
        // Basic GC pattern
        regex: /(\d+)([KMG])->(\d+)([KMG])/i,
        getValue: matches => convertToKb(matches[3], matches[4])
      },
      {
        // Heap usage pattern
        regex: /(?:heap|used)\s*[:=]\s*(\d+)([KMG])/i,
        getValue: matches => convertToKb(matches[1], matches[2])
      },
      {
        // Region size pattern
        regex: /Region Size: (\d+)([KMG])/i,
        getValue: matches => convertToKb(matches[1], matches[2])
      }
    ];

    this.phaseRegexes = [
      // Young GC
      /\[GC pause \(G1 Young Generation\) \((.+?)\)/, 
      // Mixed GC
      /\[GC pause \(G1 Mixed Generation\) \((.+?)\)/,
      // Full GC
      /\[Full GC \((.+?)\)/
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
    let phase = '', reason = '', duration = null;
    let beforeSize = null, afterSize = null;

    // Determine phase based on line content
    if (line.includes('Young Generation')) {
      phase = 'Young GC';
    } else if (line.includes('Mixed Generation')) {
      phase = 'Mixed GC';
    } else if (line.includes('Full GC')) {
      phase = 'Full GC';
    }

    // Extract memory changes
    const memoryMatch = line.match(/(\d+)([KMG])->(\d+)([KMG])/i);
    if (memoryMatch) {
      beforeSize = convertToKb(memoryMatch[1], memoryMatch[2]);
      afterSize = convertToKb(memoryMatch[3], memoryMatch[4]);
    }

    if (phase || beforeSize || afterSize) {
      return {
        timestamp: timestamp?.absolute || '',
        phase,
        beforeSize,
        afterSize
      };
    }

    return null;
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

    let firstRelativeTime = null;
    let startTime = null;

    for (const line of lines) {
      if (!line || line.trim().length === 0) continue;

      const timestamp = this.parseTimestamp(line);
      if (!timestamp) continue;

      const memoryValue = this.parseMemoryInfo(line);
      if (memoryValue === null || isNaN(memoryValue)) continue;

      if (timestamp.absolute) {
        if (!startTime) {
          startTime = new Date(timestamp.absolute);
        }
        context.absoluteLabels.push(timestamp.absolute);
        const currentTime = new Date(timestamp.absolute);
        if (!firstRelativeTime) {
          firstRelativeTime = 0;
          context.relativeLabels.push('0.000');
        } else {
          context.relativeLabels.push(((currentTime.getTime() - startTime.getTime()) / 1000).toFixed(3));
        }
      } else if (timestamp.relative) {
        if (firstRelativeTime === null) {
          firstRelativeTime = parseFloat(timestamp.relative);
        }
        const relativeTime = parseFloat(timestamp.relative);
        context.relativeLabels.push(timestamp.relative);
      }

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
      startTime: startTime ? startTime.toISOString() : null,
      collectorType: 'G1',
      events: context.events
    };
  }
}

module.exports = G1Parser;
