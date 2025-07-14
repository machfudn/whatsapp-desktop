const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exit-fullscreen-btn');
  btn.addEventListener('click', () => {
    ipcRenderer.send('exit-fullscreen');
  });
});
