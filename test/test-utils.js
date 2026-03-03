import BaseParser from '../src/parsers/base.js';

class TestParser extends BaseParser {
  parseMemoryInfo() { return null; }
  parseGCEvent() { return null; }
}

export { TestParser };
