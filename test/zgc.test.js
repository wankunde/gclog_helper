const assert = require('assert');
const ZGCParser = require('../src/parsers/zgc');

describe('ZGC Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new ZGCParser();
  });

  describe('ZGC Detection', () => {
    it('should parse ZGC format correctly', () => {
      const line = '[2025-10-24T10:39:40.815+0800][info][gc,init] ZGC initialized';
      const parser = new ZGCParser();
      const result = parser.parse(line);
      assert.strictEqual(result.collectorType, 'ZGC');
      assert.strictEqual(result.events.length, 0);
    });

    it('should parse ZGC collection correctly', () => {
      const line = '[2025-10-24T10:39:40.816+0800][info][gc] GC(0) Major Collection (System.gc()) 100M(20%)->50M(10%)';
      const parser = new ZGCParser();
      const result = parser.parse(line);
      const event = result.events[0];
      assert.strictEqual(event.beforeSize, 100 * 1024);
      assert.strictEqual(event.afterSize, 50 * 1024);
      assert.strictEqual(event.phase, 'Major Collection');
      assert.strictEqual(event.reason, 'System.gc()');
    });
  });

  describe('GC Event Parsing', () => {
    it('should parse Major Collection', () => {
      const input = '[2025-10-24T10:39:42.352+0800][info][gc] GC(0) Major Collection (Metadata GC Threshold) 110M(1%)->62M(0%) 0.035s';
      const result = parser.parse(input);
      assert.strictEqual(result.events.length, 1, 'Should have one event');
      assert.strictEqual(result.events[0].beforeSize, 110 * 1024);
      assert.strictEqual(result.events[0].afterSize, 62 * 1024);
      assert.strictEqual(result.events[0].phase, 'Major Collection');
      assert.strictEqual(result.events[0].reason, 'Metadata GC Threshold');
      assert.strictEqual(result.events[0].duration, 35); // 0.035s in ms
    });

    it('should parse Minor Collection', () => {
      const input = '[2025-10-24T10:39:42.352+0800][info][gc] GC(1) Minor Collection (Allocation Rate) 100M(42%)->50M(16%) 0.035s';
      const result = parser.parse(input);
      assert.strictEqual(result.events.length, 1, 'Should have one event');
      assert.strictEqual(result.events[0].beforeSize, 100 * 1024);
      assert.strictEqual(result.events[0].afterSize, 50 * 1024);
      assert.strictEqual(result.events[0].phase, 'Minor Collection');
      assert.strictEqual(result.events[0].reason, 'Allocation Rate');
      assert.strictEqual(result.events[0].duration, 35);
    });

    it('should handle various memory units', () => {
      const inputs = [
        '[2025-10-24T10:39:42.352+0800][info][gc] GC(0) Major Collection (Test) 1024K(1%)->512K(0%) 0.035s',
        '[2025-10-24T10:39:42.353+0800][info][gc] GC(1) Major Collection (Test) 100M(1%)->50M(0%) 0.035s',
        '[2025-10-24T10:39:42.354+0800][info][gc] GC(2) Major Collection (Test) 2G(1%)->1G(0%) 0.035s'
      ];
      
      const results = inputs.map(input => parser.parse(input));
      assert.strictEqual(results[0].events[0].afterSize, 512); // 512K
      assert.strictEqual(results[1].events[0].afterSize, 50 * 1024); // 50M
      assert.strictEqual(results[2].events[0].afterSize, 1 * 1024 * 1024); // 1G
    });
  });

  describe('Event Reason', () => {
    it('should capture collection reason', () => {
      const input = '[2025-10-24T10:39:42.352+0800][info][gc] GC(0) Major Collection (System.gc()) 100M(40%)->50M(20%) 0.035s';
      const result = parser.parse(input);
      const event = result.events[0];
      
      assert.strictEqual(event.phase, 'Major Collection');
      assert.strictEqual(event.reason, 'System.gc()');
      assert.strictEqual(event.beforeSize, 100 * 1024);
      assert.strictEqual(event.afterSize, 50 * 1024);
      assert.strictEqual(event.duration, 35); // 0.035s in ms
    });
  });
});
