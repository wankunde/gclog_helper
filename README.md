# gclog_helper

A minimal VS Code extension that parses Java GC logs and visualizes JVM memory usage trend.

How to run

1. Open this folder in VS Code.
2. Press F5 to run the extension in Extension Development Host.
3. Run the command "Open GC Log Helper" from the Command Palette.
4. Enter a path to a GC log file in the input and click "Open & Parse".

Notes

- The parser is simple and may not cover every GC log format. Extend `parser.js` to add support for your log format.
