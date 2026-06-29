import './globals.css'
import './App.css'

export const metadata = {
  title: 'React Study - Next.js',
  description: 'React + Next.js 全栈学习项目',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
