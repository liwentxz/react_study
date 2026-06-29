'use client'

import { useState, useEffect } from 'react'
import reactLogo from '../assets/react.svg'
import viteLogo from '../assets/vite.svg'
import heroImg from '../assets/hero.png'

export default function Home() {
  const [count, setCount] = useState(0)
  const [serverMessage, setServerMessage] = useState('')

  // 演示：调用后端 API
  const fetchHello = async () => {
    try {
      const res = await fetch('/api/hello')
      const data = await res.json()
      setServerMessage(data.message)
    } catch (err) {
      console.error('API 调用失败:', err)
    }
  }

  useEffect(() => {
    fetchHello()
  }, [])

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg.src} className="base" width="170" height="179" alt="" />
          <img src={reactLogo.src} className="framework" alt="React logo" />
          <img src={viteLogo.src} className="vite" alt="Next.js logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/app/page.jsx</code> and save to test <code>HMR</code>
          </p>
          {/* 后端消息展示 */}
          {serverMessage && (
            <p style={{ marginTop: 12, color: 'var(--accent)' }}>
              🖥️ 后端返回: {serverMessage}
            </p>
          )}
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://nextjs.org/docs" target="_blank">
                <img className="logo" src={viteLogo.src} alt="" />
                Explore Next.js
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo.src} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Backend API</h2>
          <p>Next.js 后端能力演示</p>
          <ul>
            <li>
              <a href="/api/hello" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GET /api/hello
              </a>
            </li>
            <li>
              <button
                onClick={fetchHello}
                style={{
                  background: 'var(--social-bg)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 16,
                  cursor: 'pointer',
                  color: 'var(--text-h)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                重新调用 API
              </button>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}
