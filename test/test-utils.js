const BaseParser = require('../src/parsers/base');

class TestParser extends BaseParser {
  parseMemoryInfo() { return null; }
  parseGCEvent() { return null; }
}

module.exports = { TestParser };
