import './globals.css'

export const metadata = {
  title: '二手设备出入账管理系统',
  description: '收购 / 出售 / 费用 / 利润全流程管理',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
