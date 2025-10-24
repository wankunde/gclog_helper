const assert = require('assert');
const BaseParser = require('../src/parsers/base');

const { TestParser } = require('./test-utils');

describe('Base Parser - Edge Cases', () => {
  let parser;

  beforeEach(() => {
    parser = new TestParser();
  });

  describe('parseTimestamp edge cases', () => {
    it('should handle invalid date format', () => {
      const line = '[2025-13-35T25:61:61.000+0800] Invalid date';
      const result = parser.parseTimestamp(line);
      assert.strictEqual(result, null);
    });

    it('should handle missing milliseconds', () => {
      const line = '[2025-10-24T10:40:27+0800] No milliseconds';
      const result = parser.parseTimestamp(line);
      assert.strictEqual(result, null);
    });
  });

  describe('error handling', () => {
    it('should handle empty line', () => {
      const result = parser.parseTimestamp('');
      assert.strictEqual(result, null);
    });

    it('should handle line with only whitespace', () => {
      const result = parser.parseTimestamp('    \t    ');
      assert.strictEqual(result, null);
    });

    it('should handle null line', () => {
      const result = parser.parseTimestamp(null);
      assert.strictEqual(result, null);
    });
  });
});
