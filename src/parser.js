// Main parser that delegates to specific GC parsers
import ZGCParser from './parsers/zgc.js';
import G1Parser from './parsers/g1.js';

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

/**
 * Converts bytes to a human-readable format (e.g. "1G", "1024M", "1024K").
 * @param {number} bytes
 * @returns {string}
 */
function formatBytesToHuman(bytes) {
  if (bytes >= 1024 * 1024 * 1024 && bytes % (1024 * 1024 * 1024) === 0) {
    return (bytes / (1024 * 1024 * 1024)) + 'G';
  }
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) {
    return (bytes / (1024 * 1024)) + 'M';
  }
  if (bytes >= 1024 && bytes % 1024 === 0) {
    return (bytes / 1024) + 'K';
  }
  return bytes + 'B';
}

/**
 * Extracts JVM metadata (GC name, max heap size) from the first 100 lines of a GC log.
 * @param {String[]} lines
 * @returns {{ gcName: string|null, maxHeapSize: string|null }}
 */
function extractMetadata(lines) {
  let gcName = null;
  let maxHeapSize = null;
  const scanLimit = Math.min(lines.length, 100);

  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i];

    // JDK 9+ gc name: "Using The Z Garbage Collector" or "Using G1"
    if (!gcName) {
      if (line.includes('Using The Z Garbage Collector')) {
        gcName = 'ZGC';
      } else if (/Using G1\b/.test(line)) {
        gcName = 'G1 GC';
      }
    }

    // JDK 9+ gc,init max heap: "Heap Max Capacity: 1G" (G1) or "Max Capacity: 16384M" (ZGC)
    if (!maxHeapSize) {
      const initHeapMatch = line.match(/(?:Heap )?Max Capacity:\s*(\d+[KMGB])/);
      if (initHeapMatch) {
        maxHeapSize = initHeapMatch[1];
      }
    }

    // JDK 8 CommandLine flags
    if (line.includes('CommandLine flags:')) {
      if (!gcName) {
        if (line.includes('-XX:+UseG1GC')) {
          gcName = 'G1 GC';
        } else if (line.includes('-XX:+UseParallelGC')) {
          gcName = 'Parallel GC';
        } else if (line.includes('-XX:+UseZGC')) {
          gcName = 'ZGC';
        } else if (line.includes('-XX:+UseShenandoahGC')) {
          gcName = 'Shenandoah GC';
        } else if (line.includes('-XX:+UseConcMarkSweepGC')) {
          gcName = 'CMS GC';
        } else if (line.includes('-XX:+UseSerialGC')) {
          gcName = 'Serial GC';
        }
      }

      if (!maxHeapSize) {
        const maxHeapMatch = line.match(/-XX:MaxHeapSize=(\d+)/);
        if (maxHeapMatch) {
          maxHeapSize = formatBytesToHuman(parseInt(maxHeapMatch[1], 10));
        }
      }
    }

    // Command line -Xmx (e.g. first line of jdk25_G1GC.log)
    if (!maxHeapSize) {
      const xmxMatch = line.match(/-Xmx(\d+)([kmgKMG]?)/);
      if (xmxMatch) {
        const value = parseInt(xmxMatch[1], 10);
        const unit = xmxMatch[2].toLowerCase();
        if (unit === 'g') {
          maxHeapSize = value + 'G';
        } else if (unit === 'm' || unit === '') {
          maxHeapSize = value + 'M';
        } else if (unit === 'k') {
          maxHeapSize = value + 'K';
        }
      }
    }
  }

  return { gcName, maxHeapSize };
}

function parse(content) {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      startTime: null,
      collectorType: 'Unknown',
      gcName: 'Unknown',
      maxHeapSize: null,
      events: []
    };
  }

  const lines = content.split(/\r?\n/);
  const metadata = extractMetadata(lines);
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
      const retryResult = parser.parse(gcLines.join('\n'));
      retryResult.gcName = metadata.gcName || retryResult.collectorType;
      retryResult.maxHeapSize = metadata.maxHeapSize || null;
      return retryResult;
    }
  }

  result.gcName = metadata.gcName || result.collectorType;
  result.maxHeapSize = metadata.maxHeapSize || null;
  return result;
}

export { parse, detectGCType };
