const assert = require('assert');
const { parse, detectGCType } = require('../src/parser');

describe('Main Parser', () => {
  describe('detectGCType', () => {
    it('should detect ZGC', () => {
      const lines = [
        '[0.001s] Using ZGC',
        '[0.002s][info][gc,init] Initializing ZGC'
      ];
      assert.strictEqual(detectGCType(lines), 'ZGC');
    });

    it('should detect G1', () => {
      const lines = [
        '[0.001s] Using G1',
        '[0.002s][info][gc] Using G1 Young Generation'
      ];
      assert.strictEqual(detectGCType(lines), 'G1');
    });

    it('should return Unknown for unrecognized GC', () => {
      const lines = [
        '[0.001s] Starting VM',
        '[0.002s][info] Some other log'
      ];
      assert.strictEqual(detectGCType(lines), 'Unknown');
    });
  });

  describe('parse', () => {
    it('should use ZGC parser for ZGC logs', () => {
      const input = `[2025-10-24T10:39:40.815+0800][info][gc,init] ZGC initialized
[2025-10-24T10:39:41.000+0800][info][gc] GC(0) Major Collection (Warmup) 4096M(40%)->2048M(20%)`;
      const result = parse(input);
      assert.strictEqual(result.collectorType, 'ZGC');
      assert.strictEqual(result.values[0], 2048 * 1024);
    });

    it('should use G1 parser for G1 logs', () => {
      const input = `[2025-10-24T10:39:40.815+0800][info][gc] Using G1
[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)`;
      const result = parse(input);
      assert.strictEqual(result.collectorType, 'G1');
      assert.strictEqual(result.values[0], 2048 * 1024);
    });

    it('should handle special format logs', () => {
      const input = '[2025-10-24T10:39:40.815+0800][info] used=1024K';
      const result = parse(input);
      assert.ok(result.values.length > 0, 'Should parse special format');
    });

    it('should throw error for unknown GC type', () => {
      const input = '[2025-10-24T10:39:40.815+0800][info] Invalid log format';
      assert.throws(() => parse(input), /Unsupported GC type/);
    });
  });

  describe('Filtering Empty Lines', () => {
    const input = '[2025-10-24T10:39:41.000+0800][info   ][gc          ] GC(0) Garbage Collection (Warmup) 2458M->1024M';
    const result = parse(input);
    assert.strictEqual(result.values[0], 1024 * 1024); // 1024M in KB
  });

  describe('G1 Format', () => {
    it('should parse KB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) 16384K->8192K(65536K)`;
      const result = parse(log);
      assert.ok(result.values.length > 0, 'No values parsed');
      assert.strictEqual(result.values[0], 8192, 'Wrong KB value');
    });

    it('should parse MB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) 100M->50M(200M)`;
      const result = parse(log);
      assert.ok(result.values.length > 0, 'No values parsed');
      assert.strictEqual(result.values[0], 50 * 1024, 'Wrong MB value');
    });

    it('should parse GB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) 4G->2G(8G)`;
      const result = parse(log);
      assert.ok(result.values.length > 0, 'No values parsed');
      assert.strictEqual(result.values[0], 2 * 1024 * 1024, 'Wrong GB value');
    });
  });

  it('should parse used=X format', () => {
    const input = '[0.123s] GC(0) Pause Young used=1024K';
    const result = parse(input);
    assert.strictEqual(result.values[0], 1024);
  });

  it('should extract timestamps', () => {
    const input = `2023-01-01T12:00:00.000: [GC 1024K->512K(2048K)]
[0.123s] GC(1) used=768K
[0.456s] GC 1024K->896K(2048K)`;
    const result = parse(input);
    assert.deepStrictEqual({
      absoluteLabels: result.absoluteLabels,
      relativeLabels: result.relativeLabels
    }, {
      absoluteLabels: ['2023-01-01T12:00:00.000'],
      relativeLabels: ['0.000', '0.123', '0.456']
    });
  });

  it('should filter out log lines without memory data', () => {
    const testLog = `[2025-10-24T10:40:27.095+0800][info   ][gc          ] GC(7) Major Collection (Warmup)
[2025-10-24T10:40:27.096+0800][info   ][gc          ] GC(8) Major Collection (System.gc()) 4096M(40%)->2048M(20%)
[2025-10-24T10:40:27.097+0800][info   ][gc          ] Another log line without memory data
[2025-10-24T10:40:27.098+0800][info   ][gc          ] GC(9) Minor Collection (Allocation Rate) 3072M(30%)->1024M(10%)`;

    // First detect the parser type
    const type = detectGCType(testLog);
    assert.strictEqual(type, 'ZGC', 'Should detect ZGC collector from log content');
    
    // Parse the content
    const result = parse(testLog);
    
    // Should only include lines with memory data
    assert.strictEqual(result.values.length, 2);
    assert.strictEqual(result.values[0], 2048 * 1024); // 2048M in KB
    assert.strictEqual(result.values[1], 1024 * 1024); // 1024M in KB
    
    // Should maintain correct timestamps
    assert.strictEqual(result.absoluteLabels.length, 2);
    assert.strictEqual(result.absoluteLabels[0], '2025-10-24T10:40:27.096');
    assert.strictEqual(result.absoluteLabels[1], '2025-10-24T10:40:27.098');

    // Should include correct events
    assert.strictEqual(result.events.length, 2);
    assert.strictEqual(result.events[0].phase, 'Major Collection');
    assert.strictEqual(result.events[0].beforeSize, 4096 * 1024); // 4096M in KB
    assert.strictEqual(result.events[0].afterSize, 2048 * 1024); // 2048M in KB
    assert.strictEqual(result.events[1].phase, 'Minor Collection');
    assert.strictEqual(result.events[1].beforeSize, 3072 * 1024); // 3072M in KB
    assert.strictEqual(result.events[1].afterSize, 1024 * 1024); // 1024M in KB
  });
});
