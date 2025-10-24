const assert = require('assert');
const { TestParser } = require('./test-utils');

describe('Base Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new TestParser();
  });

  describe('parseTimestamp', () => {
    it('should parse ISO format with timezone', () => {
      const line = '[2025-10-24T10:40:27.095+0800][info][gc]';
      const result = parser.parseTimestamp(line);
      assert.strictEqual(result.absolute, '2025-10-24T10:40:27.095');
    });

    it('should parse ISO format without timezone', () => {
      const line = '[2025-10-24T10:40:27.095][info][gc]';
      const result = parser.parseTimestamp(line);
      assert.strictEqual(result.absolute, '2025-10-24T10:40:27.095');
    });

    it('should parse explicit timestamp format', () => {
      const line = '[timestamp: 2025-10-24T10:40:27.095][info][gc]';
      const result = parser.parseTimestamp(line);
      assert.strictEqual(result.absolute, '2025-10-24T10:40:27.095');
    });

    it('should return null for unrecognized format', () => {
      const line = 'Invalid timestamp format';
      const result = parser.parseTimestamp(line, {});
      assert.strictEqual(result, null);
    });
  });
});
