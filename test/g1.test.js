import assert from 'assert';
import G1Parser from '../src/parsers/g1.js';
import { describe, it, beforeEach } from 'node:test';

describe('G1 Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new G1Parser();
  });

  describe('G1 Detection', () => {
    it('should parse G1 format correctly', () => {
      const line = '[2025-10-24T10:39:40.815+0800][info][gc] Using G1';
      const parser = new G1Parser();
      const result = parser.parse(line);
      assert.strictEqual(result.collectorType, 'G1');
    });

    it('should parse G1 memory values correctly', () => {
      const line = '[2025-10-24T10:39:40.816+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)';
      const parser = new G1Parser();
      const result = parser.parse(line);
      assert.strictEqual(result.events[0].afterSize, 2048 * 1024);
    });
  });

  describe('GC Event Parsing', () => {
    it('should parse Young GC', () => {
      const input = '[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)';
      const result = parser.parse(input);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.phase, 'Young GC');
      assert.strictEqual(event.beforeSize, 4096 * 1024);
      assert.strictEqual(event.afterSize, 2048 * 1024);
    });

    it('should parse Mixed GC', () => {
      const input = '[2025-10-24T10:39:42.000+0800][info][gc] GC pause (G1 Mixed Generation) 3072M->1024M(8192M)';
      const result = parser.parse(input);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.phase, 'Mixed GC');
      assert.strictEqual(event.beforeSize, 3072 * 1024);
      assert.strictEqual(event.afterSize, 1024 * 1024);
    });

    it('should parse Full GC', () => {
      const input = '[2025-10-24T10:39:43.000+0800][info][gc] Full GC 6144M->1536M(8192M)';
      const result = parser.parse(input);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.phase, 'Full GC');
      assert.strictEqual(event.beforeSize, 6144 * 1024);
      assert.strictEqual(event.afterSize, 1536 * 1024);
    });

    it('should parse JDK 25 unified G1 pause formats', () => {
      const input = `[2026-07-17T09:37:34.389+0800][info][gc] GC(0) Pause Young (Normal) (G1 Evacuation Pause) 85M->35M(1644M) 7.332ms
[2026-07-17T09:37:35.905+0800][info][gc] GC(4) Pause Young (Mixed) (Metadata GC Threshold) 63M->42M(1640M) 9.751ms
[2026-07-17T09:37:36.000+0800][info][gc] GC(5) Pause Full (G1 Compaction Pause) 100M->50M(1640M) 20.500ms`;

      const result = parser.parse(input);

      assert.strictEqual(result.events.length, 3);
      assert.strictEqual(result.events[0].phase, 'Young GC');
      assert.strictEqual(result.events[0].duration, 7.332);
      assert.strictEqual(result.events[0].reason, 'G1 Evacuation Pause');
      assert.strictEqual(result.events[1].phase, 'Mixed GC');
      assert.strictEqual(result.events[1].reason, 'Metadata GC Threshold');
      assert.strictEqual(result.events[2].phase, 'Full GC');
      assert.strictEqual(result.events[2].reason, 'G1 Compaction Pause');
    });

    it('should parse legacy lowercase young and mixed G1 pauses', () => {
      const input = `[2025-10-24T10:39:41.000+0800] GC pause (G1 Evacuation Pause) (young) 30773K->19437K(256M), 0.0425205 secs
[2025-10-24T10:39:42.000+0800] GC pause (G1 Evacuation Pause) (mixed) 41547K->43667K(256M), 0.0381197 secs`;

      const result = parser.parse(input);

      assert.strictEqual(result.events.length, 2);
      assert.strictEqual(result.events[0].phase, 'Young GC');
      assert.strictEqual(result.events[1].phase, 'Mixed GC');
    });

    it('should handle various memory units', () => {
      const inputs = [
        '[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 1024K->512K(2048K)',
        '[2025-10-24T10:39:42.000+0800][info][gc] GC pause (G1 Young Generation) 100M->50M(200M)',
        '[2025-10-24T10:39:43.000+0800][info][gc] GC pause (G1 Young Generation) 2G->1G(4G)'
      ];

      const results = inputs.map(input => parser.parse(input));
      assert.strictEqual(results[0].events[0].afterSize, 512);
      assert.strictEqual(results[1].events[0].afterSize, 50 * 1024);
      assert.strictEqual(results[2].events[0].afterSize, 1 * 1024 * 1024);
    });
  });

  describe('Event Details', () => {
    it('should parse event details', () => {
      const input = '[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)';
      const result = parser.parse(input);
      const event = result.events[0];

      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.phase, 'Young GC');
      assert.strictEqual(event.beforeSize, 4096 * 1024);
      assert.strictEqual(event.afterSize, 2048 * 1024);
    });
  });

  describe('Multiple Events', () => {
    it('should parse multiple events', () => {
      const input = `[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M) 15.339ms
[2025-10-24T10:39:42.000+0800][info][gc] GC pause (G1 Mixed Generation) 2048M->1024M(8192M) 20.123ms`;

      const result = parser.parse(input);
      assert.strictEqual(result.events.length, 2, 'Wrong number of events');

      // Test first event
      assert.strictEqual(result.events[0].phase, 'Young GC');
      assert.strictEqual(result.events[0].beforeSize, 4096 * 1024);
      assert.strictEqual(result.events[0].afterSize, 2048 * 1024);
      assert.strictEqual(result.events[0].duration, 15.339);

      // Test second event
      assert.strictEqual(result.events[1].phase, 'Mixed GC');
      assert.strictEqual(result.events[1].beforeSize, 2048 * 1024);
      assert.strictEqual(result.events[1].afterSize, 1024 * 1024);
      assert.strictEqual(result.events[1].duration, 20.123);
    });
  });
});
