// 预留：桌面端原生能力（如文件对话框、自动更新）在此暴露
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
})
