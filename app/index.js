const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');

let win;
let tray = null;
let aboutWin = null;
let fullscreenButtonWin = null;

function openAboutWindow() {
  // Jika jendela 'about' sudah terbuka, fokus saja
  if (aboutWin) {
    aboutWin.focus();
    return;
  }

  aboutWin = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    title: 'About ' + app.getName(),
    parent: win, // Jadikan sebagai child dari jendela utama
    modal: true, // Blokir interaksi dengan jendela utama
    autoHideMenuBar: true, // Sembunyikan menu di jendela 'about'
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  aboutWin.loadFile(path.join(__dirname, '..', 'about.html'));

  // Reset variabel saat jendela ditutup
  aboutWin.on('closed', () => {
    aboutWin = null;
  });
}

function createFullscreenButtonWindow() {
  if (fullscreenButtonWin) {
    return;
  }
  const mainBounds = win.getBounds();
  fullscreenButtonWin = new BrowserWindow({
    width: 200,
    height: 50,
    x: mainBounds.x + Math.round((mainBounds.width - 200) / 2),
    y: mainBounds.y,
    parent: win,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-fullscreen-button.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  fullscreenButtonWin.loadFile(path.join(__dirname, 'fullscreen-button.html'));
  fullscreenButtonWin.on('closed', () => (fullscreenButtonWin = null));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 800,
    resizable: true,
    maximizable: true, // Pastikan tombol maximize/restore muncul
    title: app.getName(),
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Atur User Agent agar menyerupai Chrome versi terbaru untuk menghindari deteksi Electron
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  win.loadURL('https://web.whatsapp.com', {
    userAgent: userAgent,
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Buka URL eksternal di browser default pengguna
    shell.openExternal(url);
    // Cegah Electron membuka jendela baru
    return { action: 'deny' };
  });

  win.on('minimize', function (event) {
    event.preventDefault();
    win.hide();
  });

  win.on('close', function (event) {
    event.preventDefault();
    win.hide();
  });

  win.on('enter-full-screen', () => {
    createFullscreenButtonWindow();
    win.webContents.send('fullscreen-state-changed', true);
  });

  win.on('leave-full-screen', () => {
    if (fullscreenButtonWin) {
      fullscreenButtonWin.destroy();
    }
    fullscreenButtonWin = null;
    win.webContents.send('fullscreen-state-changed', false);
  });
}

app.whenReady().then(() => {
  createWindow();

  // --- MEMBUAT MENU APLIKASI STANDAR DENGAN 'ABOUT' KUSTOM ---

  const isMac = process.platform === 'darwin';

  const menuTemplate = [
    // {app menu}
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: `About ${app.name}`, click: openAboutWindow },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    // {File} menu
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // {Edit} menu
    {
      label: 'Edit',
      submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }],
    },
    // {View} menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // {Help} menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            // Menggunakan modul shell untuk membuka link eksternal
            shell.openExternal('https://github.com/machfudn/whatsapp-desktop');
          },
        },
        // 'About' hanya muncul di menu Help untuk Windows/Linux, untuk macOS sudah ada di menu App
        ...(!isMac ? [{ label: 'About', click: openAboutWindow }] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => win.show() },
    {
      label: 'Toggle Full Screen',
      click: () => {
        // Menggunakan win.isFullScreen() untuk memeriksa status saat ini
        win.setFullScreen(!win.isFullScreen());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        win.removeAllListeners('close');
        app.quit();
      },
    },
  ]);

  tray.setToolTip('WhatsApp Desktop');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => win.show());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on('set-fullscreen-button-visibility', (event, visible) => {
  if (fullscreenButtonWin) {
    if (visible) {
      fullscreenButtonWin.show();
    } else {
      fullscreenButtonWin.hide();
    }
  }
});

ipcMain.on('exit-fullscreen', () => {
  if (win && win.isFullScreen()) {
    win.setFullScreen(false);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
