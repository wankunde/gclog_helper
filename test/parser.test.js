const assert = require('assert');
const { parse, detectGCType } = require('../src/parser');

describe('Main Parser', () => {
  describe('detectGCType', () => {
    describe('ZGC Detection', () => {
      it('should detect ZGC from initialization', () => {
        const lines = [
          '[2025-10-24T10:39:40.817+0800][info   ][gc,init ] Initializing The Z Garbage Collector'
        ];
        assert.strictEqual(detectGCType(lines), 'ZGC');
      });

      it('should detect ZGC from usage message', () => {
        const lines = [
          '[0.001s] Using The Z Garbage Collector'
        ];
        assert.strictEqual(detectGCType(lines), 'ZGC');
      });

      it('should detect ZGC from collection pattern', () => {
        const lines = [
          '[2025-10-24T10:39:43.000+0800][info][gc] GC(0) Major Collection (System.gc()) 2048M(40%)->1024M(20%)'
        ];
        assert.strictEqual(detectGCType(lines), 'ZGC');
      });
    });

    describe('G1 Detection', () => {
      it('should detect G1 from initialization', () => {
        const lines = [
          '[0.001s] Using G1'
        ];
        assert.strictEqual(detectGCType(lines), 'G1');
      });

      it('should detect G1 from young generation', () => {
        const lines = [
          '[0.002s][info][gc] Using G1 Young Generation'
        ];
        assert.strictEqual(detectGCType(lines), 'G1');
      });

      it('should detect G1 from mixed generation', () => {
        const lines = [
          '[0.002s][info][gc] GC pause (G1 Mixed Generation)'
        ];
        assert.strictEqual(detectGCType(lines), 'G1');
      });

      it('should detect G1 from pause pattern', () => {
        const lines = [
          '[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) 4096M->2048M(8192M)'
        ];
        assert.strictEqual(detectGCType(lines), 'G1');
      });
    });

    it('Use G1 for unrecognized GC type', () => {
      const lines = [
        '[0.001s] Starting VM',
        '[0.002s][info] Some other log'
      ];
      assert.strictEqual(detectGCType(lines), 'G1');
    });
  });

  describe('parse', () => {
    it('should use ZGC parser for ZGC logs', () => {
      const input = `[2025-10-24T10:39:40.815+0800][info][gc,init] ZGC initialized
[2025-10-24T10:39:41.000+0800][info][gc] GC(0) Major Collection (Warmup) 4096M(40%)->2048M(20%) 15.123ms`;
      const result = parse(input);
      assert.strictEqual(result.collectorType, 'ZGC');
      assert.strictEqual(result.events[0].afterSize, 2048 * 1024);
      assert.strictEqual(result.events[0].duration, 15.123);
    });

    it('should use G1 parser for G1 logs', () => {
      const input = `[2025-10-24T10:39:40.815+0800][info][gc] Using G1
[2025-10-24T10:39:41.000+0800][info][gc] GC pause (G1 Young Generation) (System.gc()) 4096M->2048M(8192M) 20.456ms`;
      const result = parse(input);
      assert.strictEqual(result.collectorType, 'G1');
      assert.strictEqual(result.events[0].afterSize, 2048 * 1024);
      assert.strictEqual(result.events[0].phase, 'Young GC');
      assert.strictEqual(result.events[0].duration, 20.456);
    });
  });

  describe('G1 Format', () => {
    it('should parse KB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) (System.gc()) 16384K->8192K(65536K) 15.123ms`;
      const result = parse(log);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.beforeSize, 16384);
      assert.strictEqual(event.afterSize, 8192);
      assert.strictEqual(event.duration, 15.123);
    });

    it('should parse MB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) (Allocation Failure) 100M->50M(200M) 20.456ms`;
      const result = parse(log);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.beforeSize, 100 * 1024);
      assert.strictEqual(event.afterSize, 50 * 1024);
      assert.strictEqual(event.duration, 20.456);
    });

    it('should parse GB values', () => {
      const log = `[2025-10-24T12:00:00.000+0800][info][gc] GC pause (G1 Young Generation) (System.gc()) 4G->2G(8G) 25.789ms`;
      const result = parse(log);
      const event = result.events[0];
      assert.ok(event, 'No event parsed');
      assert.strictEqual(event.beforeSize, 4 * 1024 * 1024);
      assert.strictEqual(event.afterSize, 2 * 1024 * 1024);
      assert.strictEqual(event.duration, 25.789);
    });
  });

  it('should extract timestamps and maintain chronological order', () => {
    const input = `[2023-01-01T12:00:00.000+0800]: [GC pause (G1 Young Generation) 1024K->512K(2048K) 15.123ms]
[2023-01-01T12:00:00.456+0800] GC pause (G1 Mixed Generation) 1024K->896K(2048K) 25.789ms`;
    
    const result = parse(input);
    console.log(result.events);
    assert.ok(result.events.length === 2, 'Wrong number of events');
    assert.ok(result.events.every(e => e.timestamp.length > 0), 'Missing timestamps');
    assert.ok(result.events[0].duration === 15.123, 'Wrong duration for event 1');
    assert.ok(result.events[1].duration === 25.789, 'Wrong duration for event 3');

    // Check timestamps are in order
    const timestamps = result.events.map(e => new Date(e.timestamp).getTime());
    assert.ok(timestamps[1] > timestamps[0], 'Events not in chronological order (1)');
  });

  it('should filter out log lines without GC events', () => {
    const testLog = `[2025-10-24T10:40:27.095+0800][info   ][gc          ] GC(7) Major Collection (Warmup)
[2025-10-24T10:40:27.096+0800][info   ][gc          ] GC(8) Major Collection 4096M(40%)->2048M(20%) 15.123ms
[2025-10-24T10:40:27.097+0800][info   ][gc          ] Another log line without memory data
[2025-10-24T10:40:27.098+0800][info   ][gc          ] GC(9) Minor Collection 3072M(30%)->1024M(10%) 20.456ms`;

    // First detect the parser type
    const type = detectGCType(testLog);
    assert.strictEqual(type, 'ZGC', 'Should detect ZGC collector from log content');
    
    // Parse the content
    const result = parse(testLog);
    
    // Should only include lines with GC events and memory data
    assert.strictEqual(result.events.length, 2, 'Wrong number of events');
    
    // Verify first event
    assert.strictEqual(result.events[0].timestamp, '2025-10-24T10:40:27.096');
    assert.strictEqual(result.events[0].phase, 'Major Collection');
    assert.strictEqual(result.events[0].duration, 15.123);
    assert.strictEqual(result.events[0].beforeSize, 4096 * 1024);
    assert.strictEqual(result.events[0].afterSize, 2048 * 1024);
    
    // Verify second event
    assert.strictEqual(result.events[1].timestamp, '2025-10-24T10:40:27.098');
    assert.strictEqual(result.events[1].phase, 'Minor Collection');
    assert.strictEqual(result.events[1].duration, 20.456);
    assert.strictEqual(result.events[1].beforeSize, 3072 * 1024);
    assert.strictEqual(result.events[1].afterSize, 1024 * 1024);
  });
});
