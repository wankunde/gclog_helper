import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { parse } from '../src/parser.js';
import { formatMemorySize, getColor } from './utils.js';

Chart.register(...registerables, zoomPlugin);

class GCLogViewer {
  constructor() {
    const saved = localStorage.getItem('gclog-state');
    const state = saved ? JSON.parse(saved) : { theme: 'light' };

    // Don't restore file data from localStorage (too large), only theme
    this.files = new Map();
    this.chart = null;
    this.init(state.theme);
  }

  saveState() {
    localStorage.setItem('gclog-state', JSON.stringify({
      theme: this.themeSelect.value
    }));
  }

  init(theme) {
    this.fileInput = document.getElementById('fileInput');
    this.browseBtn = document.getElementById('browseBtn');
    this.urlInput = document.getElementById('urlInput');
    this.fetchBtn = document.getElementById('fetchBtn');
    this.status = document.getElementById('status');
    this.errorDiv = document.getElementById('error');
    this.fileList = document.getElementById('fileList');
    this.themeSelect = document.getElementById('themeSelect');
    this.exportBtn = document.getElementById('exportBtn');
    this.resetZoomBtn = document.getElementById('resetZoomBtn');
    this.chartContainer = document.getElementById('chartContainer');
    this.dropHint = document.getElementById('dropHint');
    this.ctx = document.getElementById('chart').getContext('2d');

    // Initialize theme from saved state
    this.themeSelect.value = theme || 'light';
    document.body.classList.toggle('dark-theme', this.themeSelect.value === 'dark');

    // Update UI from saved state
    this.updateFileList();
    this.updateChart();

    this.setupEventListeners();

    // Support ?url=xxx query parameter for sharing
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam) {
      this.urlInput.value = urlParam;
      this.handleUrl(urlParam);
    }
  }

  toggleDetailTable() {
    const detailTable = document.getElementById('detailTable');
    const detailBtn = document.getElementById('detailBtn');
    const isVisible = detailTable.classList.contains('show');

    detailTable.classList.toggle('show');
    detailBtn.textContent = isVisible ? 'Show Details' : 'Hide Details';

    if (!isVisible) {
      this.updateDetailTable();
    }
  }

  updateDetailTable() {
    const tbody = document.querySelector('#detailTable tbody');
    tbody.innerHTML = '';

    for (const [path, { data }] of this.files) {
      data.events.forEach((event) => {
        const row = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = event.timestamp;

        const appTimeCell = document.createElement('td');
        appTimeCell.textContent = event.appTime;

        const phaseCell = document.createElement('td');
        phaseCell.textContent = event.phase;

        const durationCell = document.createElement('td');
        durationCell.textContent = event.duration?.toFixed(2) || '-';

        const beforeSizeCell = document.createElement('td');
        beforeSizeCell.textContent = event.beforeSize ?
          (event.beforeSize / 1024).toFixed(2) : '-';

        const afterSizeCell = document.createElement('td');
        afterSizeCell.textContent = event.afterSize ?
          (event.afterSize / 1024).toFixed(2) : '-';

        const detailsCell = document.createElement('td');
        detailsCell.textContent = event.reason || '-';

        row.appendChild(timeCell);
        row.appendChild(appTimeCell);
        row.appendChild(phaseCell);
        row.appendChild(durationCell);
        row.appendChild(beforeSizeCell);
        row.appendChild(afterSizeCell);
        row.appendChild(detailsCell);

        tbody.appendChild(row);
      });
    }
  }

  async handleUrl(url) {
    try {
      this.errorDiv.textContent = '';
      this.status.textContent = `Fetching ${url}...`;

      let content;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        content = await res.text();
      } catch (directErr) {
        this.status.textContent = `Retrying via CORS proxy...`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy fetch failed: HTTP ${res.status}`);
        content = await res.text();
      }

      const result = parse(content);
      if (!result || (!result.values?.length && !result.events?.length)) {
        this.errorDiv.textContent = `No valid GC data found from URL`;
        this.status.textContent = 'Error';
        return;
      }

      const displayName = url.split('/').pop().split('?')[0] || 'remote-log';
      const key = `${displayName}_${Date.now()}`;
      this.addFileData(key, displayName, result);
    } catch (err) {
      console.error('Fetch error:', err);
      this.errorDiv.textContent = `Failed to fetch URL: ${err.message}`;
      this.status.textContent = 'Error';
    }
  }

  async handleFiles(fileList) {
    for (const file of fileList) {
      try {
        this.errorDiv.textContent = '';
        this.status.textContent = `Parsing ${file.name}...`;

        const content = await file.text();
        const result = parse(content);

        if (!result || (!result.values?.length && !result.events?.length)) {
          this.errorDiv.textContent = `No valid GC data found in ${file.name}`;
          this.status.textContent = 'Error';
          continue;
        }

        // Use filename + timestamp as key to avoid collisions
        const key = `${file.name}_${Date.now()}`;
        this.addFileData(key, file.name, result);
      } catch (err) {
        console.error('Parse error:', err);
        this.errorDiv.textContent = `Error parsing ${file.name}: ${err.message}`;
        this.status.textContent = 'Error';
      }
    }
  }

  setupEventListeners() {
    // Browse button triggers hidden file input
    this.browseBtn.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Fetch URL button
    this.fetchBtn.addEventListener('click', () => {
      const url = this.urlInput.value.trim();
      if (!url) {
        this.errorDiv.textContent = 'Please enter a URL';
        return;
      }
      this.handleUrl(url);
    });

    // Enter key submits URL
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.fetchBtn.click();
      }
    });

    // File input change handler
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files.length > 0) {
        this.handleFiles(this.fileInput.files);
        this.fileInput.value = ''; // Reset so same file can be selected again
      }
    });

    this.themeSelect.addEventListener('change', () => {
      document.body.classList.toggle('dark-theme', this.themeSelect.value === 'dark');
      this.updateChartTheme();
      this.saveState();
    });

    this.exportBtn.addEventListener('click', () => {
      if (this.chart) {
        const link = document.createElement('a');
        link.download = 'gc-analysis.png';
        link.href = this.chart.toBase64Image();
        link.click();
      }
    });

    this.resetZoomBtn.addEventListener('click', () => {
      if (this.chart) {
        this.chart.resetZoom();
      }
    });

    const detailBtn = document.getElementById('detailBtn');
    detailBtn.addEventListener('click', () => {
      this.toggleDetailTable();
    });

    // Drag and drop support
    this.chartContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.chartContainer.classList.add('drag-over');
    });

    this.chartContainer.addEventListener('dragleave', () => {
      this.chartContainer.classList.remove('drag-over');
    });

    this.chartContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      this.chartContainer.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this.handleFiles(e.dataTransfer.files);
      }
    });
  }

  addFileData(key, displayName, data) {
    const fileIndex = this.files.size;
    const color = getColor(fileIndex);
    this.files.set(key, { color, data, hidden: false, customLabel: null, displayName });
    this.updateDropHint();
    this.updateFileList();
    this.updateChart();
    this.saveState();
    this.status.textContent = 'Done';
  }

  removeFile(path) {
    this.files.delete(path);
    this.updateDropHint();
    this.updateFileList();
    this.updateChart();
    this.saveState();
  }

  updateDropHint() {
    if (this.dropHint) {
      this.dropHint.style.display = this.files.size === 0 ? 'block' : 'none';
    }
  }

  updateFileList() {
    const tbody = this.fileList.querySelector('tbody');
    tbody.innerHTML = '';
    this.fileList.classList.toggle('has-files', this.files.size > 0);

    for (const [key, { color, data, customLabel, displayName }] of this.files) {
      const row = document.createElement('tr');

      // Color picker cell
      const colorCell = document.createElement('td');
      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.className = 'color-picker';
      colorPicker.value = color;
      colorPicker.addEventListener('change', (e) => {
        this.files.get(key).color = e.target.value;
        this.updateChart();
      });
      colorCell.appendChild(colorPicker);

      // File name cell (editable)
      const nameCell = document.createElement('td');
      const label = document.createElement('span');
      label.contentEditable = true;
      label.textContent = customLabel || displayName;
      label.style.cursor = 'pointer';
      label.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      label.addEventListener('blur', (e) => {
        const newLabel = e.target.textContent.trim();
        if (newLabel) {
          this.files.get(key).customLabel = newLabel;
          this.updateChart();
          this.saveState();
        }
      });
      label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
      nameCell.appendChild(label);

      // GC Type cell
      const gcTypeCell = document.createElement('td');
      gcTypeCell.textContent = data.gcName || data.collectorType || '-';

      // Max Heap cell
      const maxHeapCell = document.createElement('td');
      maxHeapCell.textContent = data.maxHeapSize || '-';

      // Delete button cell
      const actionCell = document.createElement('td');
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => this.removeFile(key));
      actionCell.appendChild(removeBtn);

      row.appendChild(colorCell);
      row.appendChild(nameCell);
      row.appendChild(gcTypeCell);
      row.appendChild(maxHeapCell);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    }
  }

  updateChartTheme() {
    const isDark = this.themeSelect.value === 'dark';
    const gridColor = isDark ? 'rgba(74, 53, 53, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#ffffff' : '#666666';

    if (this.chart) {
      this.chart.options.scales.x.grid.color = gridColor;
      this.chart.options.scales.y.grid.color = gridColor;
      this.chart.options.scales.x.ticks.color = textColor;
      this.chart.options.scales.y.ticks.color = textColor;
      this.chart.update();
    }
  }

  updateChart() {
    let datasets = [];
    const detailTable = document.getElementById('detailTable');
    if (detailTable.classList.contains('show')) {
      this.updateDetailTable();
    }

    Array.from(this.files.entries()).forEach(([key, { color, data, hidden, customLabel, displayName }]) => {
      if (hidden) return;

      const heapData = [];
      for (let i = 0; i < data.events.length; i++) {
        let event = data.events[i];
        heapData.push({
          x: event.appTime,
          y: event.beforeSize,
          timestamp: event.timestamp
        });
        heapData.push({
          x: event.appTime,
          y: event.afterSize,
          timestamp: event.timestamp
        });
      }

      datasets.push({
        label: customLabel || displayName,
        data: heapData,
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.1
      });
    });

    if (this.chart) {
      this.chart.destroy();
    }

    const isDark = this.themeSelect.value === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#ffffff' : '#666666';

    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        parsing: false,
        scales: {
          x: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: 'Time',
              color: textColor
            },
            grid: { color: gridColor },
            ticks: { color: textColor }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Memory Usage',
              color: textColor
            },
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: function (value) {
                return formatMemorySize(value);
              }
            }
          }
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: { enabled: false },
              pinch: { enabled: true },
              mode: 'x',
              drag: { enabled: true }
            },
            pan: { enabled: true }
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                return context[0].parsed.timestamp;
              },
              label: function (context) {
                return context.dataset.label + ': ' + formatMemorySize(context.parsed.y);
              }
            }
          }
        }
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GCLogViewer();
});
