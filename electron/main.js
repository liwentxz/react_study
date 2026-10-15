const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')

// 注册自定义协议，让 file 打包产物里的 /_next 绝对路径能正确解析
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
])

const isDev = !app.isPackaged
const outDir = path.join(__dirname, '../out')

function setupProtocol() {
  protocol.handle('app', (request) => {
    try {
      const u = new URL(request.url)
      let p = decodeURIComponent(u.pathname)
      if (p === '/' || p === '') p = '/index.html'
      if (p.endsWith('/')) p += 'index.html'
      // 兼容 Next.js 路由后缀：/foo -> /foo.html
      const fs = require('fs')
      let file = path.normalize(path.join(outDir, p))
      if (!file.startsWith(outDir)) file = path.join(outDir, 'index.html')
      if (!fs.existsSync(file) && !path.extname(file)) {
        const htmlTry = file + '.html'
        if (fs.existsSync(htmlTry)) file = htmlTry
        else file = path.join(outDir, 'index.html')
      }
      return net.fetch('file://' + file)
    } catch {
      return net.fetch('file://' + path.join(outDir, 'index.html'))
    }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    title: '二手设备出入账管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:3000')
  } else {
    win.loadURL('app://localhost/index.html')
  }
}

app.whenReady().then(() => {
  setupProtocol()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
