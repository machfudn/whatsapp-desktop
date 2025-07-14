const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

const store = new Store();

let win;
let tray = null;
let aboutWin = null;
let fullscreenButtonWin = null;

// --- MANAJEMEN PENGGUNA (DENGAN PENYIMPANAN) ---

function loadUserData() {
  let users = store.get('users');

  // If no users exist in the store, or the list is empty, create and save a default.
  if (!users || users.length === 0) {
    const defaultUser = { name: 'User 1', partition: 'user-1' };
    users = [defaultUser];
    store.set('users', users);
    store.set('currentUserPartition', defaultUser.partition);
  }

  const currentUserPartition = store.get('currentUserPartition');
  let currentUser = users.find(u => u.partition === currentUserPartition);

  // If the stored currentUserPartition is invalid (e.g., user was deleted), reset to the first user.
  if (!currentUser) {
    currentUser = users[0];
    store.set('currentUserPartition', currentUser.partition);
  }

  return { users, currentUser };
}

let { users, currentUser } = loadUserData();

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
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  aboutWin.loadFile(path.join(__dirname, 'about.html'));

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

function createWindow(partition) {
  win = new BrowserWindow({
    width: 1100,
    height: 800,
    resizable: true,
    maximizable: true, // Pastikan tombol maximize/restore muncul
    title: app.getName(),
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      // Gunakan partisi dengan 'persist:' untuk menyimpan sesi (login, cookie, dll)
      partition: `persist:${partition}`,
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

function buildMenu() {
  const isMac = process.platform === 'darwin';

  // Membuat item menu untuk setiap pengguna
  const userMenuItems = users.map((user, index) => ({
    label: `${user.name}`,
    type: 'radio',
    checked: user.partition === currentUser.partition,
    click: () => {
      if (currentUser.partition === user.partition) return;

      const oldWin = win;
      currentUser = user;
      store.set('currentUserPartition', currentUser.partition); // Simpan pengguna saat ini
      console.log(`Berpindah ke pengguna: ${currentUser.name}`);

      // Buat jendela baru SEBELUM menghancurkan yang lama untuk mencegah aplikasi quit
      createWindow(currentUser.partition);
      oldWin.destroy();
      buildMenu(); // Bangun ulang menu
    },
  }));

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
    // {Users} menu
    {
      label: 'Users',
      submenu: [
        ...userMenuItems,
        { type: 'separator' },
        {
          label: 'Add User',
          click: () => {
            const oldWin = win;
            let uniquePartition;
            let idx = users.length + 1;
            do {
              uniquePartition = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            } while (users.some(u => u.partition === uniquePartition));

            const newUserName = `User ${idx}`;
            const newUser = { name: newUserName, partition: uniquePartition };
            users.push(newUser);
            currentUser = newUser;
            store.set('users', users);
            store.set('currentUserPartition', currentUser.partition);

            console.log(`Menambahkan dan berpindah ke pengguna: ${currentUser.name}`);

            // Buat jendela baru SEBELUM menghancurkan yang lama
            createWindow(currentUser.partition);
            oldWin.destroy();
            buildMenu();
          },
        },
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
}

app.whenReady().then(() => {
  createWindow(currentUser.partition);

  buildMenu();

  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
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
    // Pastikan untuk membuat jendela dengan partisi yang benar saat diaktifkan
    if (BrowserWindow.getAllWindows().length === 0) createWindow(currentUser.partition);
  });

  // Mencegah pembuatan tab/jendela baru dari Dock di macOS
  app.on('new-window-for-tab', event => {
    event.preventDefault();
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
