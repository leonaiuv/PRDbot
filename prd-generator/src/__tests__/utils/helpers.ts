/**
 * 测试辅助函数
 */

import { db } from '@/lib/db'

/**
 * 清理测试数据库
 */
export async function clearTestDatabase() {
  await db.projects.clear()
  await db.settings.clear()
  await db.chatDrafts.clear()
  await db.prdTasks.clear()
  // 清理翻译相关表
  if (db.translationTasks) {
    await db.translationTasks.clear()
  }
  if (db.translationCache) {
    await db.translationCache.clear()
  }
  // 清理AI分析结果表
  if (db.analysisResults) {
    await db.analysisResults.clear()
  }
}

/**
 * 等待异步操作完成
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 等待条件满足
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await waitFor(50)
  }

  throw new Error('Timeout waiting for condition')
}

/**
 * Mock fetch响应
 */
export function mockFetchResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

/**
 * Mock SSE流式响应
 */
export function mockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/**
 * 创建Mock AbortController
 */
export function createMockAbortController() {
  let aborted = false
  const abortHandlers: Array<() => void> = []

  return {
    signal: {
      aborted: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'abort') {
          abortHandlers.push(handler)
        }
      },
      removeEventListener: () => {},
    },
    abort: () => {
      aborted = true
      abortHandlers.forEach(handler => handler())
    },
    isAborted: () => aborted,
  }
}

/**
 * 验证时间戳
 */
export function isValidTimestamp(timestamp: number): boolean {
  return (
    typeof timestamp === 'number' &&
    timestamp > 0 &&
    timestamp <= Date.now() + 1000 // 允许1秒的时钟偏差
  )
}

/**
 * 验证UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// ========== 新增：高级测试辅助函数 ==========

/**
 * Mock clipboard API
 */
export function mockClipboardAPI() {
  const clipboard = {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  }

  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    writable: true,
    configurable: true,
  })

  return clipboard
}

/**
 * Mock window.open
 */
export function mockWindowOpen() {
  const mockWindow = {
    document: {
      write: jest.fn(),
      close: jest.fn(),
    },
    print: jest.fn(),
    close: jest.fn(),
    onload: null as (() => void) | null,
    closed: false,
  }

  const originalOpen = window.open
  window.open = jest.fn(() => mockWindow) as unknown as typeof window.open

  return {
    mockWindow,
    restore: () => {
      window.open = originalOpen
    },
  }
}

/**
 * 模拟网络延迟
 */
export async function simulateNetworkDelay(ms: number = 100): Promise<void> {
  await waitFor(ms)
}

/**
 * 模拟网络错误
 */
export function simulateNetworkError(message: string = 'Network error'): Error {
  return new Error(message)
}

/**
 * 创建流式响应（带中断功能）
 */
export function createInterruptibleStream(chunks: string[], interruptAt?: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let currentIndex = 0

  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        if (interruptAt !== undefined && currentIndex >= interruptAt) {
          // 模拟中断
          clearInterval(interval)
          controller.error(new Error('Stream interrupted'))
          return
        }

        if (currentIndex >= chunks.length) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          clearInterval(interval)
          return
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunks[currentIndex] })}\n\n`))
        currentIndex++
      }, 10)
    },
  })
}

/**
 * 验证JSON格式
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length)
}

/**
 * 创建延迟的Promise
 */
export function delayedPromise<T>(value: T, delay: number): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), delay)
  })
}

/**
 * 模拟IndexedDB错误
 */
export function simulateIndexedDBError(errorType: 'QuotaExceeded' | 'NotFound' | 'Transaction'): Error {
  const errors = {
    QuotaExceeded: new Error('QuotaExceededError'),
    NotFound: new Error('NotFoundError'),
    Transaction: new Error('TransactionError'),
  }
  return errors[errorType]
}

/**
 * 检查对象是否深度相等
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2)
}

/**
 * 生成指定大小的文本（用于测试大数据）
 */
export function generateLargeText(sizeInKB: number): string {
  const chunkSize = 1024 // 1KB
  const chunks = []
  for (let i = 0; i < sizeInKB; i++) {
    chunks.push('A'.repeat(chunkSize))
  }
  return chunks.join('')
}

/**
 * 验证是否为SSRF危险URL
 */
export function isDangerousURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    
    // 检查内网地址
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ]
    
    return privatePatterns.some(pattern => pattern.test(hostname))
  } catch {
    return true // 无效URL也认为危险
  }
}
