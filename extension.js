const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const parser = require('./src/parser');

function activate(context) {
  let currentPanel = null;

  let disposable = vscode.commands.registerCommand('gclog_helper.open', function () {
    // If we already have a panel, show it
    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Otherwise, create a new panel
    currentPanel = vscode.window.createWebviewPanel(
      'gclogHelper',
      'GC Log Helper',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
        retainContextWhenHidden: true // Keep the webview content when hidden
      }
    );

    // Reset when the panel is closed
    currentPanel.onDidDispose(
      () => {
        currentPanel = null;
      },
      null,
      context.subscriptions
    );

    const scriptUri = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'webview.js')));
    const chartUri = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'chart.min.js')));
    const zoomPluginUri = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'chartjs-plugin-zoom.min.js')));

    currentPanel.webview.html = getWebviewContent(scriptUri, chartUri, zoomPluginUri, currentPanel.webview.cspSource);

    currentPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'browse') {
        const result = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'Log Files': ['log'] }
        });
        if (result && result[0]) {
          currentPanel.webview.postMessage({ type: 'filepath', path: result[0].fsPath });
        }
      } else if (message.command === 'parse') {
        const filePath = message.path;
        try {
          console.log('Reading file:', filePath);
          const content = await fs.promises.readFile(filePath, 'utf8');
          console.log('Parsing content:', content.slice(0, 200) + '...');  // Log first 200 chars
          const result = parser.parse(content);
          console.log('Parse result:', result);
          if (!result || (!result.values?.length && !result.events?.length)) {
            throw new Error('No valid GC data found in the file');
          }
          currentPanel.webview.postMessage({ type: 'result', data: result });
        } catch (err) {
          console.error('Parse error:', err);
          currentPanel.webview.postMessage({ type: 'error', error: String(err) });
        }
      }
    }, undefined, context.subscriptions);
  });

  context.subscriptions.push(disposable);
}
exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;

function getWebviewContent(scriptUri, chartUri, zoomPluginUri, cspSource) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' http: https:; script-src https: 'unsafe-inline' ${cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GC Log Helper</title>
  <style>
    body { 
      font-family: sans-serif; 
      margin: 10px;
      --bg-color: #ffffff;
      --text-color: #000000;
    }
    body.dark-theme {
      --bg-color: #1e1e1e;
      --text-color: #ffffff;
    }
    body {
      background-color: var(--bg-color);
      color: var(--text-color);
    }
    #controls { 
      margin-bottom: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center; 
    }
    .control-group {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    input[type=text] { 
      width: 300px; 
      padding: 6px;
      background: var(--bg-color);
      color: var(--text-color);
      border: 1px solid #666;
    }
    button { 
      padding: 6px 12px;
      background: #0078d4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #106ebe;
    }
    #chartContainer { 
      width: 100%; 
      height: 400px;
      position: relative;
      background: var(--bg-color);
      border: 1px solid #666;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
    }
    #error { color: #ff6b6b; }
    #gcType {
      display: none;
      padding: 6px 12px;
      background: #0078d4;
      color: white;
      border-radius: 4px;
      margin-left: 10px;
    }
    select {
      padding: 6px;
      background: var(--bg-color);
      color: var(--text-color);
      border: 1px solid #666;
    }
    .chart-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 5px;
      z-index: 100;
    }
    #fileList {
      width: 100%;
      margin: 10px 0;
    }
    .file-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 5px 0;
      padding: 5px;
      border: 1px solid #666;
      border-radius: 4px;
    }
    .color-picker {
      width: 30px;
      height: 30px;
      padding: 0;
      border: none;
    }
    #legendContainer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 10px 0;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border: 1px solid #666;
      border-radius: 4px;
      cursor: pointer;
      opacity: 1;
      transition: opacity 0.2s;
    }
    .legend-item.disabled {
      opacity: 0.5;
    }
    .legend-color {
      width: 15px;
      height: 15px;
      border-radius: 3px;
    }
    #detailTable {
      width: 100%;
      margin-top: 20px;
      border-collapse: collapse;
      display: none;
    }
    #detailTable th, #detailTable td {
      border: 1px solid #666;
      padding: 8px;
      text-align: left;
    }
    #detailTable th {
      background-color: var(--bg-color);
      color: var(--text-color);
      font-weight: bold;
    }
    #detailTable tr:nth-child(even) {
      background-color: rgba(128, 128, 128, 0.1);
    }
    #detailTable.show {
      display: table;
    }
  </style>
</head>
<body>
  <div id="controls">
    <div class="control-group">
      <input id="pathInput" type="text" placeholder="Enter path to GC log file" />
      <button id="browseBtn">Browse...</button>
      <button id="openBtn" style="display: none;">Add to Chart</button>
      <span id="gcType"></span>
    </div>
    <div class="control-group">
      <span id="gcType" style="padding: 6px; background: #2d2d2d; border-radius: 4px; display: none;"></span>
    </div>
    <div class="control-group">
      <button id="detailBtn">Show GC Details</button>
      <button id="exportBtn">Export PNG</button>
      <button id="resetZoomBtn">Reset Zoom</button>
    </div>
    <div class="control-group">
      <select id="themeSelect">
        <option value="light">Light Theme</option>
        <option value="dark">Dark Theme</option>
      </select>
    </div>
    <div id="legendContainer"></div>
    <span id="status"></span>
    <div id="error"></div>
  </div>
  <div id="fileList"></div>
  <div id="chartContainer">
    <div class="chart-controls"></div>
    <canvas id="chart"></canvas>
  </div>

  <table id="detailTable">
    <thead>
      <tr>
        <th>Time</th>
        <th>AppTime</th>
        <th>Phase</th>
        <th>Duration (ms)</th>
        <th>Before Size (MB)</th>
        <th>After Size (MB)</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <script src="${chartUri}"></script>
  <script src="${zoomPluginUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
