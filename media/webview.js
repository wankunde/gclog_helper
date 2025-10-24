const vscode = acquireVsCodeApi();

const { formatMemorySize, getRandomColor } = (function() {
  function convertToKb(value, unit) {
    switch(unit.toUpperCase()) {
      case 'K': return parseInt(value);
      case 'M': return parseInt(value) * 1024;
      case 'G': return parseInt(value) * 1024 * 1024;
      default: return parseInt(value);
    }
  }

  function formatMemorySize(value) {
    if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' GB';
    if (value >= 1024) return (value / 1024).toFixed(2) + ' MB';
    return value + ' KB';
  }

  function getRandomColor() {
    const colors = [
      '#4dc9f6', '#f67019', '#f53794', '#537bc4',
      '#acc236', '#166a8f', '#00a950', '#58595b'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  return { formatMemorySize, getRandomColor };
})();

class GCLogViewer {
  constructor() {
    // Restore state or initialize new state
    const state = vscode.getState() || {
      files: {},
      theme: 'light'
    };
    
    this.files = new Map(Object.entries(state.files));
    this.chart = null;
    this.init(state.theme);
  }

  saveState() {
    // Convert Map to plain object for state storage
    const files = {};
    this.files.forEach((value, key) => {
      files[key] = value;
    });

    vscode.setState({
      files,
      theme: this.themeSelect.value
    });
  }

  init(theme) {
    this.input = document.getElementById('pathInput');
    this.browseBtn = document.getElementById('browseBtn');
    this.openBtn = document.getElementById('openBtn');
    this.status = document.getElementById('status');
    this.errorDiv = document.getElementById('error');
    this.fileList = document.getElementById('fileList');
    this.themeSelect = document.getElementById('themeSelect');
    this.exportBtn = document.getElementById('exportBtn');
    this.resetZoomBtn = document.getElementById('resetZoomBtn');
    this.ctx = document.getElementById('chart').getContext('2d');

    // Initialize theme and time format from saved state
    this.themeSelect.value = theme || 'light';
    document.body.classList.toggle('dark-theme', this.themeSelect.value === 'dark');
    
    // Update UI from saved state
    this.updateFileList();
    this.updateChart();

    this.setupEventListeners();
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
      const filename = path.split('/').pop();
      
      data.events.forEach((event, index) => {
        const row = document.createElement('tr');
        
        // Time cell
        const timeCell = document.createElement('td');
        timeCell.textContent = event.timestamp;

        // AppTime cell
        const appTimeCell = document.createElement('td');
        appTimeCell.textContent = event.appTime;

        // Phase cell
        const phaseCell = document.createElement('td');
        phaseCell.textContent = event.phase;
        
        // Duration cell
        const durationCell = document.createElement('td');
        durationCell.textContent = event.duration?.toFixed(2) || '-';
        
        // Before Size cell
        const beforeSizeCell = document.createElement('td');
        beforeSizeCell.textContent = event.beforeSize ? 
          (event.beforeSize / 1024).toFixed(2) : '-';
        
        // After Size cell
        const afterSizeCell = document.createElement('td');
        afterSizeCell.textContent = event.afterSize ? 
          (event.afterSize / 1024).toFixed(2) : '-';
        
        // Details cell
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

  setupEventListeners() {
    this.browseBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'browse' });
    });

    this.openBtn.addEventListener('click', () => {
      const path = this.input.value.trim();
      if (!path) {
        this.errorDiv.textContent = 'Please enter a file path or use Browse...';
        return;
      }
      this.errorDiv.textContent = '';
      this.status.textContent = 'Parsing...';
      vscode.postMessage({ command: 'parse', path });
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

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const msg = event.data;
      console.log('Received message:', msg);
      if (msg.type === 'filepath') {
        this.input.value = msg.path;
        this.openBtn.click();
      } else if (msg.type === 'result') {
        this.status.textContent = 'Log has been parsed';
        if (!msg.data || (!msg.data.values?.length && !msg.data.events?.length)) {
          this.errorDiv.textContent = 'No valid GC data found in the file';
          this.status.textContent = 'Error';
          return;
        }
        
        this.addFileData(this.input.value, msg.data);
      } else if (msg.type === 'error') {
        console.error('Parse error:', msg.error);
        this.errorDiv.textContent = msg.error;
        this.status.textContent = 'Error';
      }
    });
  }

  addFileData(path, data) {
    const color = getRandomColor();
    this.files.set(path, { color, data, hidden: false, customLabel: null });
    this.status.textContent = 'Update file list';
    this.updateFileList();

    this.status.textContent = 'Update chart';
    this.updateChart();
    this.status.textContent = 'save state';
    this.saveState();
    this.status.textContent = 'Done';
  }

  removeFile(path) {
    this.files.delete(path);
    this.updateFileList();
    this.updateChart();
    this.saveState();
  }

  updateFileList() {
    this.fileList.innerHTML = '';
    for (const [path, { color, customLabel }] of this.files) {
      this.status.textContent = 'Prepare color picker for ' + path;
      const item = document.createElement('div');
      item.className = 'file-item';
      
      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.className = 'color-picker';
      colorPicker.value = color;
      colorPicker.addEventListener('change', (e) => {
        this.files.get(path).color = e.target.value;
        this.updateChart();
      });
      
      this.status.textContent = 'Prepare label for ' + path;
      const label = document.createElement('span');
      label.contentEditable = true;
      label.textContent = customLabel || path.split('/').pop(); // Show custom label or filename
      label.style.cursor = 'pointer';
      label.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      label.addEventListener('blur', (e) => {
        const newLabel = e.target.textContent.trim();
        if (newLabel) {
          this.files.get(path).customLabel = newLabel;
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

      this.status.textContent = 'Prepare removeBtn for ' + path;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => this.removeFile(path));

      item.appendChild(colorPicker);
      item.appendChild(label);
      item.appendChild(removeBtn);
      this.fileList.appendChild(item);
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
    // Update detail table if it's visible
    // this.status.textContent = 'Update detail table';
    const detailTable = document.getElementById('detailTable');
    if (detailTable.classList.contains('show')) {
      this.updateDetailTable();
    }

    Array.from(this.files.entries()).forEach(([path, { color, data, hidden, customLabel }]) => {
      if (hidden) return;
      
      let datasetLabel = path.split('/').pop();
      this.status.textContent = 'Add dataset from ' + path;
      // Create heap size data points for before and after each GC event
      const heapData = [];
      for(let i = 0; i < data.events.length; i++){
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
        label: customLabel || path.split('/').pop(),
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
              callback: function(value) {
                return formatMemorySize(value);
              }
            }
          }
        },
        plugins: {
          zoom: {
            zoom: {
              wwheel: { enabled: false }, // Disable mouse wheel zoom
              pinch: { enabled: true },
              mode: 'x',
              drag: { enabled: true } // Enable drag-to-zoom
            },
            pan: { enabled: true }
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                return context[0].parsed.timestamp;
              },
              label: function(context) {
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
