const { app, BrowserWindow } = require('electron');
const path = require('path');

const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'UIC Quotation Manager - Universal Inspection Co. Ltd.',
    icon: path.join(__dirname, '../pwa-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  const rootHtml = path.join(__dirname, '../index.html');
  const htmlPath = fs.existsSync(distHtml) ? distHtml : rootHtml;
  win.loadFile(htmlPath);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
