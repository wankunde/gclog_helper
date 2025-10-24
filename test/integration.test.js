const assert = require('assert');
const G1Parser = require('../src/parsers/g1');
const ZGCParser = require('../src/parsers/zgc');

describe('Parser Integration Tests', () => {
  describe('Mixed GC Logs', () => {
    it('should parse mixed G1 and ZGC format logs', () => {
      const g1Parser = new G1Parser();
      const zgcParser = new ZGCParser();
      const mixedLog = `[2025-10-24T10:39:40.815+0800][info][gc] Using G1
[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)
[2025-10-24T10:39:42.000+0800][info][gc,init] ZGC initialized
[2025-10-24T10:39:43.000+0800][info][gc] GC(0) Major Collection (Warmup) 2048M(40%)->1024M(20%)`;

      const g1Result = g1Parser.parse(mixedLog);
      const zgcResult = zgcParser.parse(mixedLog);

      // Verify G1 results
      assert.ok(g1Result.values.length > 0, 'No G1 values parsed');
      assert.strictEqual(g1Result.values[0], 2048 * 1024, 'Wrong G1 value');
      assert.strictEqual(g1Result.events[0].phase, 'Young GC', 'Wrong G1 phase');

      // Verify ZGC results
      assert.ok(zgcResult.values.length > 0, 'No ZGC values parsed');
      assert.strictEqual(zgcResult.values[0], 1024 * 1024, 'Wrong ZGC value');
      assert.strictEqual(zgcResult.events[0].phase, 'Major Collection', 'Wrong ZGC phase');
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
        largeLog += `[2025-10-24T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000+0800][info][gc] GC(${i}) Major Collection (System.gc()) ${4096-i}M(40%)->${2048-i}M(20%)\n`;
      }

      const startTime = process.hrtime();
      const result = zgcParser.parse(largeLog);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      assert.ok(result.values.length === 1000, 'Wrong number of parsed values');
      assert.ok(duration < 1000, `Parsing took ${duration}ms, should be under 1000ms`);
    });
  });

  describe('Error Recovery', () => {
    let parser;

    beforeEach(() => {
      parser = new ZGCParser();
    });

    it('should handle invalid lines gracefully', () => {
      const log = `[2025-10-24T10:40:27.095+0800][info][gc] Invalid line
[2025-10-24T10:40:27.096+0800][info][gc] GC(8) Major Collection (System.gc()) 100M(40%)->50M(20%)
[2025-10-24T10:40:27.097+0800][info][gc] Another invalid line
[2025-10-24T10:40:27.098+0800][info][gc] GC(9) Minor Collection (Allocation Rate) 50M(20%)->25M(10%)`;

      const result = parser.parse(log);
      assert.strictEqual(result.values.length, 2, 'Wrong number of valid values');
      assert.strictEqual(result.values[0], 50 * 1024, 'First value incorrect');
      assert.strictEqual(result.values[1], 25 * 1024, 'Second value incorrect');
    });

    it('should handle corrupted data gracefully', () => {
      const log = `[2025-10-24T10:40:27.095+0800][info][gc] GC(8) Major Collection (System.gc()) INVALID->2048M(20%)
[2025-10-24T10:40:27.096+0800][info][gc] GC(9) Major Collection (System.gc()) 100M(20%)->50M(10%)`;

      const result = parser.parse(log);
      assert.strictEqual(result.values.length, 1, 'Should only parse valid value');
      assert.strictEqual(result.values[0], 50 * 1024, 'Valid value incorrect');
    });

    it('should handle missing timestamps gracefully', () => {
      const log = `Invalid line without timestamp
[2025-10-24T10:40:27.096+0800][info][gc] GC(9) Major Collection (System.gc()) 100M(20%)->50M(10%)
Another invalid line`;

      const result = parser.parse(log);
      assert.strictEqual(result.values.length, 1, 'Should parse valid line');
      assert.strictEqual(result.absoluteLabels.length, 1, 'Should capture valid timestamp');
      assert.strictEqual(result.values[0], 50 * 1024, 'Valid value incorrect');
    });
  });
});
