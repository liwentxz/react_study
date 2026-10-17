#!/usr/bin/env node
'use strict'

const { execFileSync, spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const NEXT_DIR = path.join(PROJECT_ROOT, '.next')
const TRACE_FILE = path.join(NEXT_DIR, 'trace')
const NEXT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const IS_WINDOWS = process.platform === 'win32'
const PREFIX = '[dev:clean]'

function log(message) {
  console.log(`${PREFIX} ${message}`)
}

function warn(message) {
  console.warn(`${PREFIX} ${message}`)
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\\/g, '/')
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function shorten(value, max = 96) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function toArray(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function listWindowsProcesses() {
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    "$procs = @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,ParentProcessId,CommandLine)",
    'if ($procs.Count -eq 0) { "[]" } else { ConvertTo-Json -InputObject $procs -Compress }',
  ].join('; ')

  let raw = ''
  try {
    raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
    })
  } catch (error) {
    warn(`无法枚举进程列表：${error.message}`)
    return []
  }

  let parsed
  try {
    parsed = JSON.parse(raw.trim() || '[]')
  } catch {
    parsed = []
  }

  return toArray(parsed)
    .map((item) => ({
      pid: Number(item.ProcessId),
      ppid: Number(item.ParentProcessId),
      commandLine: item.CommandLine || '',
    }))
    .filter((item) => Number.isInteger(item.pid) && item.pid > 0)
}

function listPosixProcesses() {
  let raw = ''
  try {
    raw = execFileSync('ps', ['-eo', 'pid=,ppid=,command='], { encoding: 'utf8' })
  } catch (error) {
    warn(`无法枚举进程列表：${error.message}`)
    return []
  }

  return raw
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
      if (!match) return null
      return { pid: Number(match[1]), ppid: Number(match[2]), commandLine: match[3].trim() }
    })
    .filter(Boolean)
}

function collectSelfTree(processes) {
  const parents = new Map(processes.map((item) => [item.pid, item.ppid]))
  const tree = new Set()
  let current = process.pid
  while (current && !tree.has(current)) {
    tree.add(current)
    current = parents.get(current)
  }
  return tree
}

function findStaleDevServers() {
  const processes = IS_WINDOWS ? listWindowsProcesses() : listPosixProcesses()
  const selfTree = collectSelfTree(processes)
  const root = normalize(PROJECT_ROOT)

  return processes.filter((item) => {
    if (selfTree.has(item.pid)) return false
    const command = normalize(item.commandLine)
    if (!command.includes(root)) return false
    if (command.includes('dev-clean')) return false
    return command.includes('node_modules/next/') || command.includes('node_modules/.bin/')
  })
}

function killProcess(pid) {
  if (IS_WINDOWS) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } catch {
      /* 进程可能已随父进程一起结束 */
    }
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* 进程已退出 */
  }
}

function waitForExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  const pending = new Set(pids)
  while (pending.size > 0 && Date.now() < deadline) {
    for (const pid of [...pending]) {
      if (!isProcessAlive(pid)) pending.delete(pid)
    }
    if (pending.size === 0) break
    sleep(150)
  }
  return [...pending]
}

function stopStaleDevServers() {
  const stale = findStaleDevServers()
  if (stale.length === 0) {
    log('没有残留的 dev server 进程')
    return
  }

  for (const item of stale) {
    killProcess(item.pid)
  }

  let survivors = new Set(waitForExit(stale.map((item) => item.pid), 5000))

  if (!IS_WINDOWS && survivors.size > 0) {
    for (const pid of survivors) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* 进程已退出 */
      }
    }
    survivors = new Set(waitForExit([...survivors], 3000))
  }

  for (const item of stale) {
    const killed = !survivors.has(item.pid)
    log(`${killed ? '已结束' : '结束失败'} PID ${item.pid} — ${shorten(item.commandLine)}`)
  }

  if (survivors.size > 0) {
    warn(`仍有 ${survivors.size} 个进程未退出，可能需要以管理员身份重试，或在任务管理器中手动结束`)
  }
}

function isTraceUsable() {
  if (!fs.existsSync(TRACE_FILE)) return true
  try {
    const handle = fs.openSync(TRACE_FILE, 'a')
    fs.closeSync(handle)
    return true
  } catch {
    return false
  }
}

function removeNextDir() {
  if (!fs.existsSync(NEXT_DIR)) return false
  try {
    fs.rmSync(NEXT_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    return true
  } catch (error) {
    warn(`删除 .next 失败：${error.message}`)
    warn('请先关闭占用该目录的程序（其他 dev server、文件同步或杀毒软件）再重试')
    process.exit(1)
  }
}

function resolveNextState({ reset }) {
  if (reset) {
    log(removeNextDir() ? '已按 --reset 清空 .next 缓存' : '没有 .next 目录需要清理')
    return
  }

  if (isTraceUsable()) {
    log('.next 缓存可用，已保留（如需彻底重建请加 --reset）')
    return
  }

  warn('.next/trace 仍被占用，改为清空整个 .next 缓存')
  removeNextDir()
}

function startDevServer(nextArgs) {
  const useLocalNext = fs.existsSync(NEXT_BIN)
  const command = useLocalNext ? process.execPath : 'npx'
  const args = useLocalNext ? [NEXT_BIN, 'dev', ...nextArgs] : ['next', 'dev', ...nextArgs]

  log(`启动 dev server：next dev${nextArgs.length ? ` ${nextArgs.join(' ')}` : ''}`)

  const child = spawn(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: !useLocalNext && IS_WINDOWS,
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!child.killed) {
        try {
          child.kill(signal)
        } catch {
          /* 进程已退出 */
        }
      }
    })
  }

  child.on('error', (error) => {
    warn(`启动失败：${error.message}`)
    process.exitCode = 1
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      log(`dev server 收到 ${signal} 已退出`)
      process.exitCode = 130
      return
    }
    process.exitCode = code === null ? 0 : code
  })
}

function main() {
  const rawArgs = process.argv.slice(2)
  const reset = rawArgs.includes('--reset')
  const skipStart = rawArgs.includes('--no-start')
  const nextArgs = rawArgs.filter((arg) => arg !== '--reset' && arg !== '--no-start')

  log(`项目目录：${PROJECT_ROOT}`)
  stopStaleDevServers()
  resolveNextState({ reset })

  if (skipStart) {
    log('--no-start 已指定，仅完成清理')
    return
  }

  startDevServer(nextArgs)
}

main()
