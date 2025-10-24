const assert = require('assert');
const G1Parser = require('../src/parsers/g1');
const ZGCParser = require('../src/parsers/zgc');

describe('Parser Integration Tests', () => {
  describe('Mixed GC Logs', () => {
    it('should parse mixed G1 and ZGC format logs', () => {
      const g1Parser = new G1Parser();
      const zgcParser = new ZGCParser();
      const g1Log = `[2025-10-24T10:39:40.815+0800][info][gc] Using G1
[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) (System.gc()) 4096M->2048M(8192M) 15.339ms`;

      const g1Result = g1Parser.parse(g1Log);

      // Verify G1 results
      assert.ok(g1Result.events.length > 0, 'No G1 events parsed');
      assert.strictEqual(g1Result.events[0].afterSize, 2048 * 1024, 'Wrong G1 value');
      assert.strictEqual(g1Result.events[0].phase, 'Young GC', 'Wrong G1 phase');
      assert.strictEqual(g1Result.events[0].duration, 15.339, 'Wrong G1 duration');

      const zgcLog = `[2025-10-24T10:39:40.817+0800][info   ][gc,init ] Initializing The Z Garbage Collector
[2025-10-24T10:39:43.000+0800][info][gc] GC(0) Major Collection (Warmup) 2048M(40%)->1024M(20%) 20.123ms`;

      const zgcResult = zgcParser.parse(zgcLog);
      // Verify ZGC results
      assert.ok(zgcResult.events.length > 0, 'No ZGC events parsed');
      assert.strictEqual(zgcResult.events[0].afterSize, 1024 * 1024, 'Wrong ZGC value');
      assert.strictEqual(zgcResult.events[0].phase, 'Major Collection', 'Wrong ZGC phase');
      assert.strictEqual(zgcResult.events[0].duration, 20.123, 'Wrong ZGC duration');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large log files efficiently', () => {
      const zgcParser = new ZGCParser();
      let largeLog = '';
      // Generate 1000 log entries

      for (let i = 0; i < 1000; i++) {
        const hour = Math.floor(i / 60); // 每 60 秒为 1 小时
        const minute = i % 60;
        largeLog += `[2025-10-24T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000+0800][info][gc] GC(${i}) Major Collection (System.gc()) ${4096 - i}M(40%)->${2048 - i}M(20%) ${(15 + Math.random() * 10).toFixed(3)}ms\n`;
      }

      const startTime = process.hrtime();
      const result = zgcParser.parse(largeLog);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      assert.strictEqual(result.events.length, 1000, 'Wrong number of parsed events');
      assert.ok(duration < 1000, `Parsing took ${duration}ms, should be under 1000ms`);

      // Verify events contain all required fields
      const firstEvent = result.events[0];
      assert.ok(firstEvent.timestamp, 'Event missing timestamp');
      assert.strictEqual(firstEvent.phase, 'Major Collection', 'Wrong phase');
      assert.ok(firstEvent.duration > 0, 'Missing duration');
      assert.strictEqual(firstEvent.beforeSize, 4096 * 1024, 'Wrong before size');
      assert.strictEqual(firstEvent.afterSize, 2048 * 1024, 'Wrong after size');
    });
  });

  describe('Error Recovery', () => {
    let parser;

    beforeEach(() => {
      parser = new ZGCParser();
    });

    it('should handle invalid lines gracefully', () => {
      const log = `[2025-10-24T10:40:27.095+0800][info][gc] Invalid line
[2025-10-24T10:40:27.096+0800][info][gc] GC(8) Major Collection (System.gc()) 100M(40%)->50M(20%) 15.123ms
[2025-10-24T10:40:27.097+0800][info][gc] Another invalid line
[2025-10-24T10:40:27.098+0800][info][gc] GC(9) Minor Collection (Allocation Rate) 50M(20%)->25M(10%) 20.456ms`;

      const result = parser.parse(log);
      assert.strictEqual(result.events.length, 2, 'Wrong number of valid events');
      assert.strictEqual(result.events[0].afterSize, 50 * 1024, 'First event value incorrect');
      assert.strictEqual(result.events[0].duration, 15.123, 'First event duration incorrect');
      assert.strictEqual(result.events[1].afterSize, 25 * 1024, 'Second event value incorrect');
      assert.strictEqual(result.events[1].duration, 20.456, 'Second event duration incorrect');
    });

    it('should handle corrupted data gracefully', () => {
      const log = `[2025-10-24T10:40:27.095+0800][info][gc] GC(8) Major Collection (System.gc()) INVALID->2048M(20%)
[2025-10-24T10:40:27.096+0800][info][gc] GC(9) Major Collection (System.gc()) 100M(20%)->50M(10%) 15.123ms`;

      const result = parser.parse(log);
      assert.strictEqual(result.events.length, 1, 'Should only parse valid event');
      assert.strictEqual(result.events[0].afterSize, 50 * 1024, 'Valid event value incorrect');
      assert.strictEqual(result.events[0].duration, 15.123, 'Valid event duration incorrect');
    });

    it('should handle missing timestamps gracefully', () => {
      const log = `Invalid line without timestamp
[2025-10-24T10:40:27.096+0800][info][gc] GC(9) Major Collection (System.gc()) 100M(20%)->50M(10%) 15.123ms
Another invalid line`;

      const result = parser.parse(log);
      assert.strictEqual(result.events.length, 1, 'Should parse valid line');
      assert.ok(result.events[0].timestamp, 'Should capture valid timestamp');
      assert.strictEqual(result.events[0].afterSize, 50 * 1024, 'Valid event value incorrect');
      assert.strictEqual(result.events[0].duration, 15.123, 'Valid event duration incorrect');
    });
  });
});
