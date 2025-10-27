# GC Log Helper

A minimal VS Code extension that parses Java GC logs and visualizes JVM memory usage trend.

## Features

- Parse GC logs from different garbage collectors (G1, ZGC)
- Visualize memory usage over time
- Support for multiple log formats and timestamps
- Interactive chart with zoom and pan functionality
- Export visualization as PNG

## Supported GC Types

- **G1 GC**: Young Generation, Mixed Generation, and Full GC events
- **ZGC**: Major and Minor collection events

## How to Run

1. Open this folder in VS Code.
2. Press F5 to run the extension in Extension Development Host.
3. Run the command "Open GC Log Helper" from the Command Palette.
4. Enter a path to a GC log file in the input and click "Add to Chart".

## Build & Deploy

### Prerequisites

- Node.js (>=14.0.0)
- VS Code Extension Manager (`vsce`) : `npm install -g vsce`
  - `npm install --save-dev @types/node @types/vscode`

### Packaging

To package the extension for distribution:

```bash
vsce package
```

This will create a `.vsix` file that can be installed in VS Code.

### Publishing

To publish to the VS Code Marketplace:

```bash
vsce publish
```

## Notes

- The parser is simple and may not cover every GC log format. Extend `src/parsers/` to add support for your log format.

## License

MIT
