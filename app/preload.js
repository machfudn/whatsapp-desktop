const { ipcRenderer } = require('electron');

let hideButtonTimeout = null;
let isFullscreen = false;

const handleMouseMove = event => {
  // Tampilkan tombol jika mouse berada di 20px teratas layar
  if (event.clientY < 20) {
    ipcRenderer.send('set-fullscreen-button-visibility', true);
    // Hapus timeout yang ada untuk menyembunyikan tombol
    if (hideButtonTimeout) {
      clearTimeout(hideButtonTimeout);
      hideButtonTimeout = null;
    }
    // Atur timeout baru untuk menyembunyikan tombol setelah jeda
    hideButtonTimeout = setTimeout(() => {
      ipcRenderer.send('set-fullscreen-button-visibility', false);
    }, 2000); // Sembunyikan setelah 2 detik
  }
};

ipcRenderer.on('fullscreen-state-changed', (event, state) => {
  isFullscreen = state;
  if (isFullscreen) {
    document.addEventListener('mousemove', handleMouseMove);
  } else {
    document.removeEventListener('mousemove', handleMouseMove);
    if (hideButtonTimeout) {
      clearTimeout(hideButtonTimeout);
      hideButtonTimeout = null;
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // preload actions or bridge can go here
});
