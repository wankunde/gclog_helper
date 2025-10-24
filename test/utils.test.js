const assert = require('assert');
const { convertToKb, formatMemorySize, isG1Log, isZGCLog } = require('../src/utils');

describe('Utils', () => {
  describe('Memory Conversion', () => {
    it('should convert KB values', () => {
      assert.strictEqual(convertToKb('1024', 'K'), 1024);
    });

    it('should convert MB values', () => {
      assert.strictEqual(convertToKb('1', 'M'), 1024);
    });

    it('should convert GB values', () => {
      assert.strictEqual(convertToKb('1', 'G'), 1024 * 1024);
    });

    it('should handle invalid units', () => {
      assert.strictEqual(convertToKb('1024', 'X'), 1024);
    });
  });

  describe('Memory Formatting', () => {
    it('should format KB values', () => {
      assert.strictEqual(formatMemorySize(512), '512 KB');
    });

    it('should format MB values', () => {
      assert.strictEqual(formatMemorySize(1024), '1.00 MB');
    });

    it('should format GB values', () => {
      assert.strictEqual(formatMemorySize(1024 * 1024), '1.00 GB');
    });
  });

  describe('GC Type Detection', () => {
    describe('G1 Detection', () => {
      it('should detect G1 log', () => {
        const lines = [
          '[0.001s] Using G1',
          '[0.002s][info][gc] Using G1 Young Generation'
        ];
        assert.strictEqual(isG1Log(lines), true);
      });

      it('should detect G1 log from pause', () => {
        const lines = [
          '[0.001s][gc] GC pause (G1 Young Generation)'
        ];
        assert.strictEqual(isG1Log(lines), true);
      });

      it('should not detect non-G1 log', () => {
        const lines = [
          '[0.001s] Using ZGC',
          '[0.002s][info][gc] Some other log'
        ];
        assert.strictEqual(isG1Log(lines), false);
      });
    });

    describe('ZGC Detection', () => {
      it('should detect ZGC log from init', () => {
        const lines = [
          '[0.001s][info][gc,init] ZGC initialized'
        ];
        assert.strictEqual(isZGCLog(lines), true);
      });

      it('should detect ZGC log from usage', () => {
        const lines = [
          '[0.001s] Using ZGC'
        ];
        assert.strictEqual(isZGCLog(lines), true);
      });

      it('should not detect non-ZGC log', () => {
        const lines = [
          '[0.001s] Using G1',
          '[0.002s][info][gc] Some other log'
        ];
        assert.strictEqual(isZGCLog(lines), false);
      });
    });
  });
});
