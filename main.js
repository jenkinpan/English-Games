const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    titleBarStyle: 'hiddenInset', // macOS 风格
    backgroundColor: '#f7f8fc',
    show: false // 先不显示，等加载完成后再显示
  });

  // 加载 index.html
  const indexPath = path.join(__dirname, 'index.html');
  mainWindow.loadFile(indexPath);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // 开发模式下可以打开开发者工具
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 处理新窗口打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      // 如果是外部链接（http/https），在默认浏览器中打开
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      // 文件链接和相对路径链接允许在当前窗口打开（不阻止，让 Electron 自然处理）
    } catch (e) {
      // URL 解析失败，可能是相对路径，允许在当前窗口打开
    }
    // 允许打开，但会在当前窗口加载
    return { action: 'allow' };
  });

  // 当窗口被关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理导航（只阻止外部链接，允许所有文件链接在应用内打开）
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      // 只阻止外部链接（http/https），文件链接允许在应用内打开
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
      // file:// 协议和相对路径的链接不阻止，允许在应用内导航
    } catch (e) {
      // URL 解析失败，可能是相对路径，允许导航
    }
  });
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用程序及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 安全设置：处理新窗口创建
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      // 如果是外部链接，在默认浏览器中打开
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
      // file:// 协议的链接允许在当前窗口打开
    } catch (e) {
      // URL 解析失败，可能是相对路径，允许在当前窗口打开
    }
  });
});

