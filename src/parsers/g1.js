import BaseParser from './base.js';
import { convertToKb, parseDuration } from '../utils.js';

class G1Parser extends BaseParser {
  constructor() {
    super();
  }

  parseGCEvent(line, timestamp, startTime) {
    let phase = '', duration = null;
    let beforeSize = null, afterSize = null;
    let reason = '';

    // Determine phase based on both legacy and JDK 9+ unified logging formats.
    // Unified logging reports mixed collections as "Pause Young (Mixed)", so
    // mixed must be checked before the general young-pause pattern.
    if (line.includes('Mixed Generation') ||
      /GC pause.*\(mixed\)/i.test(line) ||
      /\bPause Young\s+\(Mixed\)/i.test(line)) {
      phase = 'Mixed GC';
    } else if (line.includes('Young Generation') ||
      /GC pause.*\(young\)/i.test(line) ||
      /\bPause Young\b/i.test(line)) {
      phase = 'Young GC';
    } else if (line.includes('Full GC') || /\bPause Full\b/i.test(line)) {
      phase = 'Full GC';
    } else {
      return null;
    }

    // Extract duration if available
    const durationMatch = line.match(/(\d+\.\d+)\s*(m?s)/);
    if (durationMatch) {
      duration = parseDuration(durationMatch[0]);
    }
    // Extract memory changes
    const memoryMatch = line.match(/(\d+)([KMG])->(\d+)([KMG])/i);
    if (memoryMatch) {
      beforeSize = convertToKb(memoryMatch[1], memoryMatch[2]);
      afterSize = convertToKb(memoryMatch[3], memoryMatch[4]);
    } else {
      return null; // Memory data is essential for G1 events
    }

    // Extract reason if available
    const phaseDetails = new Set([
      'young',
      'mixed',
      'normal',
      'concurrent start',
      'prepare mixed'
    ]);
    const eventDescription = line.slice(0, memoryMatch.index);
    const reasonMatches = [...eventDescription.matchAll(/\(([^)]+)\)/g)]
      .map(match => match[1].trim())
      .filter(value => !/^\d+$/.test(value) && !phaseDetails.has(value.toLowerCase()));
    if (reasonMatches.length > 0) {
      reason = reasonMatches.at(-1);
    }

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

export default G1Parser;
