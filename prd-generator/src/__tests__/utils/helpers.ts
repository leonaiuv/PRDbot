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
