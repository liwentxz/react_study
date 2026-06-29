/**
 * 示例 API 路由
 * GET /api/hello
 *
 * 这就是后端逻辑！你可以在这里：
 * - 查询数据库
 * - 调用第三方 API
 * - 处理业务逻辑
 * - 操作文件系统
 * - 等等...
 */
export async function GET() {
  const messages = [
    '你好，这是来自 Next.js 后端的数据！',
    'Hello from Next.js server!',
    `当前服务端时间: ${new Date().toLocaleString('zh-CN')}`,
    '你成功调用了后端 API 🎉',
  ]

  // 随机返回一条消息
  const message = messages[Math.floor(Math.random() * messages.length)]

  return Response.json({
    message,
    timestamp: Date.now(),
  })
}
