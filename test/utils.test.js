const assert = require('assert');
const { convertToKb, formatMemorySize } = require('../src/utils');

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

});
