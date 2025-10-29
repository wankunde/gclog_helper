// Utility functions for webview
function formatMemorySize(value) {
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' GB';
  if (value >= 1024) return (value / 1024).toFixed(2) + ' MB';
  return value + ' KB';
}

function getColor(index) {
  const colors = [
    '#4dc9f6', '#f67019', '#f53794', '#537bc4',
    '#acc236', '#166a8f', '#00a950', '#58595b'
  ];
  return colors[index % colors.length];
}