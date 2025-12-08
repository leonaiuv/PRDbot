/**
 * PRD 生成去重逻辑测试
 * 测试防止多次并发请求和请求竞态问题
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { usePRDGenerationStore } from '@/store'
import { prdTasksDB } from '@/lib/db'
import { clearTestDatabase, waitFor, mockSSEStream } from '../utils/helpers'
import { createTestProject, createTestSettings } from '../utils/factories'

// 模拟 generatePRD 的核心逻辑
interface GeneratePRDOptions {
  projectId: string
  generationLock: { current: boolean }
  activeRequestId: { current: string | null }
  onContentUpdate: (content: string, requestId: string) => void
  onComplete: (fullContent: string, requestId: string) => void
  onError: (error: Error, requestId: string) => void
  abortSignal?: AbortSignal
}

/**
 * 模拟 generatePRD 函数的核心去重逻辑
 */
async function simulateGeneratePRD(
  options: GeneratePRDOptions,
  mockFetch: () => Promise<Response>,
  delayMs: number = 0
): Promise<{ requestId: string; completed: boolean }> {
  const { projectId, generationLock, activeRequestId, onContentUpdate, onComplete, onError, abortSignal } = options

  // P7: 检查锁
  if (generationLock.current) {
    return { requestId: '', completed: false }
  }

  // 设置锁
  generationLock.current = true

  // 生成唯一请求 ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  activeRequestId.current = requestId

  try {
    if (delayMs > 0) {
      await waitFor(delayMs)
    }

    // 检查是否被取代
    if (activeRequestId.current !== requestId) {
      return { requestId, completed: false }
    }

    const response = await mockFetch()

    // 再次检查
    if (activeRequestId.current !== requestId) {
      return { requestId, completed: false }
    }

    if (!response.ok) {
      throw new Error('Request failed')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      // 检查是否被取代
      if (activeRequestId.current !== requestId) {
        reader.cancel()
        return { requestId, completed: false }
      }

      // 检查是否被取消
      if (abortSignal?.aborted) {
        reader.cancel()
        throw new DOMException('Request aborted', 'AbortError')
      }

      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const { content } = JSON.parse(data)
          if (content && activeRequestId.current === requestId) {
            fullContent += content
            onContentUpdate(content, requestId)
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 最终检查
    if (activeRequestId.current !== requestId) {
      return { requestId, completed: false }
    }

    onComplete(fullContent, requestId)
    return { requestId, completed: true }

  } catch (error) {
    if (activeRequestId.current !== requestId) {
      return { requestId, completed: false }
    }

    if (error instanceof Error) {
      onError(error, requestId)
    }
    return { requestId, completed: false }
  } finally {
    if (activeRequestId.current === requestId) {
      generationLock.current = false
      activeRequestId.current = null
    }
  }
}

describe('PRD 生成去重逻辑测试', () => {
  beforeEach(async () => {
    await clearTestDatabase()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await clearTestDatabase()
    usePRDGenerationStore.setState({ tasks: {}, contentChunks: {} })
  })

  describe('请求锁机制', () => {
    it('应该阻止并发请求', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const completedRequests: string[] = []
      const blockedRequests: number[] = []

      const mockFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream(['Hello', ' World']),
      } as Response)

      // 同时发起多个请求
      const requests = Array.from({ length: 5 }, (_, i) =>
        simulateGeneratePRD(
          {
            projectId: 'test-project',
            generationLock,
            activeRequestId,
            onContentUpdate: () => {},
            onComplete: (_, requestId) => completedRequests.push(requestId),
            onError: () => {},
          },
          mockFetch,
          i === 0 ? 50 : 0 // 第一个请求有延迟，模拟实际场景
        ).then(result => {
          if (!result.completed && !result.requestId) {
            blockedRequests.push(i)
          }
          return result
        })
      )

      const results = await Promise.all(requests)

      // 只有一个请求应该完成
      expect(completedRequests.length).toBe(1)
      
      // 其他请求应该被锁阻止
      expect(blockedRequests.length).toBe(4)
      
      // 验证锁已释放
      expect(generationLock.current).toBe(false)
      expect(activeRequestId.current).toBeNull()
    })

    it('第一个请求完成后锁应该释放', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const completedRequests: string[] = []

      const mockFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream(['Content']),
      } as Response)

      // 第一个请求
      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: (_, requestId) => completedRequests.push(requestId),
          onError: () => {},
        },
        mockFetch
      )

      expect(completedRequests.length).toBe(1)
      expect(generationLock.current).toBe(false)

      // 第二个请求应该能正常执行
      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: (_, requestId) => completedRequests.push(requestId),
          onError: () => {},
        },
        mockFetch
      )

      expect(completedRequests.length).toBe(2)
    })

    it('错误发生时锁应该释放', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const errors: Error[] = []

      const mockFetch = () => Promise.resolve({
        ok: false,
        status: 500,
      } as Response)

      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: () => {},
          onError: (error) => errors.push(error),
        },
        mockFetch
      )

      expect(errors.length).toBe(1)
      expect(generationLock.current).toBe(false)
      expect(activeRequestId.current).toBeNull()
    })
  })

  describe('请求 ID 机制', () => {
    it('旧请求不应该覆盖新请求的结果', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const contentUpdates: Array<{ content: string; requestId: string }> = []

      // 模拟慢速响应
      const slowFetch = () => new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            body: mockSSEStream(['Slow Content']),
          } as Response)
        }, 100)
      })

      // 模拟快速响应
      const fastFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream(['Fast Content']),
      } as Response)

      // 启动慢请求
      const slowPromise = simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: (content, requestId) => {
            contentUpdates.push({ content, requestId })
          },
          onComplete: () => {},
          onError: () => {},
        },
        slowFetch
      )

      // 等待锁释放（慢请求需要手动模拟被取代）
      await waitFor(10)

      // 手动模拟取代：直接修改 activeRequestId
      const oldRequestId = activeRequestId.current
      activeRequestId.current = 'new-request-id'
      generationLock.current = false

      // 启动快请求
      const fastPromise = simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: (content, requestId) => {
            contentUpdates.push({ content, requestId })
          },
          onComplete: () => {},
          onError: () => {},
        },
        fastFetch
      )

      await Promise.all([slowPromise, fastPromise])

      // 验证慢请求的内容没有被写入（因为 requestId 不匹配）
      const slowUpdates = contentUpdates.filter(u => u.requestId === oldRequestId)
      expect(slowUpdates.length).toBe(0)
    })

    it('每次请求应该生成唯一的请求 ID', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const requestIds: string[] = []

      const mockFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream(['Content']),
      } as Response)

      // 执行多个顺序请求
      for (let i = 0; i < 3; i++) {
        const result = await simulateGeneratePRD(
          {
            projectId: 'test-project',
            generationLock,
            activeRequestId,
            onContentUpdate: () => {},
            onComplete: () => {},
            onError: () => {},
          },
          mockFetch
        )
        if (result.requestId) {
          requestIds.push(result.requestId)
        }
      }

      // 验证所有请求 ID 都是唯一的
      const uniqueIds = new Set(requestIds)
      expect(uniqueIds.size).toBe(requestIds.length)
    })
  })

  describe('AbortController 集成', () => {
    it('取消信号应该中断请求', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const errors: Error[] = []
      const abortController = new AbortController()

      // 模拟慢速响应
      const slowFetch = () => new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            body: mockSSEStream(['Content']),
          } as Response)
        }, 200)
      })

      // 启动请求
      const promise = simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: () => {},
          onError: (error) => errors.push(error),
          abortSignal: abortController.signal,
        },
        slowFetch
      )

      // 立即取消
      await waitFor(50)
      abortController.abort()

      const result = await promise

      // 请求应该被取消
      expect(result.completed).toBe(false)
      
      // 锁应该释放
      expect(generationLock.current).toBe(false)
    })
  })

  describe('Store 集成测试', () => {
    it('startTask 应该返回可用的 AbortController', () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-project'

      const abortController = store.startTask(projectId)

      expect(abortController).toBeInstanceOf(AbortController)
      expect(abortController.signal.aborted).toBe(false)

      const task = store.getTask(projectId)
      expect(task?.phase).toBe('generating')
      expect(task?.abortController).toBe(abortController)
    })

    it('多次 startTask 应该创建新的 AbortController', () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-project'

      const controller1 = store.startTask(projectId)
      const controller2 = store.startTask(projectId)

      // 应该是不同的 controller
      expect(controller1).not.toBe(controller2)
    })

    it('appendTaskContent 应该正确追加内容', () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-project'

      store.startTask(projectId)
      store.appendTaskContent(projectId, '第一部分')
      store.appendTaskContent(projectId, '第二部分')
      store.appendTaskContent(projectId, '第三部分')

      const content = store.getTaskContent(projectId)
      expect(content).toBe('第一部分第二部分第三部分')
    })

    it('clearTask 应该清除任务状态', async () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-project'

      store.startTask(projectId)
      store.appendTaskContent(projectId, 'Content')

      await store.clearTask(projectId)

      const task = store.getTask(projectId)
      expect(task).toBeUndefined()
    })
  })

  describe('边界情况', () => {
    it('空内容流应该正常处理', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      let completedContent = ''

      const mockFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream([]),
      } as Response)

      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: (content) => { completedContent = content },
          onError: () => {},
        },
        mockFetch
      )

      expect(completedContent).toBe('')
      expect(generationLock.current).toBe(false)
    })

    it('大量内容块应该正确拼接', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      let completedContent = ''

      // 生成 100 个内容块
      const chunks = Array.from({ length: 100 }, (_, i) => `Chunk${i}`)

      const mockFetch = () => Promise.resolve({
        ok: true,
        body: mockSSEStream(chunks),
      } as Response)

      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: (content) => { completedContent = content },
          onError: () => {},
        },
        mockFetch
      )

      expect(completedContent).toBe(chunks.join(''))
    })

    it('网络错误应该正确处理', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      const errors: Error[] = []

      const mockFetch = () => Promise.reject(new Error('Network error'))

      await simulateGeneratePRD(
        {
          projectId: 'test-project',
          generationLock,
          activeRequestId,
          onContentUpdate: () => {},
          onComplete: () => {},
          onError: (error) => errors.push(error),
        },
        mockFetch
      )

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('Network error')
      expect(generationLock.current).toBe(false)
    })

    it('快速连续调用应该只处理第一个', async () => {
      const generationLock = { current: false }
      const activeRequestId = { current: null as string | null }
      let callCount = 0

      const mockFetch = () => {
        callCount++
        return Promise.resolve({
          ok: true,
          body: mockSSEStream(['Content']),
        } as Response)
      }

      // 快速连续调用 10 次
      const promises = Array.from({ length: 10 }, () =>
        simulateGeneratePRD(
          {
            projectId: 'test-project',
            generationLock,
            activeRequestId,
            onContentUpdate: () => {},
            onComplete: () => {},
            onError: () => {},
          },
          mockFetch
        )
      )

      await Promise.all(promises)

      // 只有第一个请求应该执行 fetch
      expect(callCount).toBe(1)
    })
  })

  describe('自动生成触发器', () => {
    it('autoGenerateTriggered ref 应该防止重复触发', () => {
      const autoGenerateTriggered = { current: false }
      let triggerCount = 0

      // 模拟 useEffect 逻辑
      const triggerAutoGenerate = () => {
        if (autoGenerateTriggered.current) return
        autoGenerateTriggered.current = true
        triggerCount++
      }

      // 模拟多次 effect 执行
      for (let i = 0; i < 5; i++) {
        triggerAutoGenerate()
      }

      expect(triggerCount).toBe(1)
    })

    it('页面刷新后应该重置触发状态', () => {
      // 模拟组件重新挂载
      let autoGenerateTriggered = { current: false }
      let triggerCount = 0

      const triggerAutoGenerate = () => {
        if (autoGenerateTriggered.current) return
        autoGenerateTriggered.current = true
        triggerCount++
      }

      // 第一次挂载
      triggerAutoGenerate()
      expect(triggerCount).toBe(1)

      // 模拟卸载后重新挂载
      autoGenerateTriggered = { current: false }
      triggerAutoGenerate()
      expect(triggerCount).toBe(2)
    })
  })

  describe('持久化集成', () => {
    it('任务应该正确持久化到数据库', async () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-persist-project'

      store.startTask(projectId)

      // 等待异步持久化
      await waitFor(100)

      const persisted = await prdTasksDB.get(projectId)
      expect(persisted).toBeDefined()
      expect(persisted?.projectId).toBe(projectId)
      expect(persisted?.phase).toBe('generating')
    })

    it('completeTask 应该更新持久化状态', async () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-complete-project'

      store.startTask(projectId)
      store.appendTaskContent(projectId, 'Final content')
      await store.completeTask(projectId)

      const persisted = await prdTasksDB.get(projectId)
      expect(persisted?.phase).toBe('completed')
    })

    it('errorTask 应该持久化错误状态', async () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-error-project'

      store.startTask(projectId)
      await store.errorTask(projectId, '测试错误')

      const persisted = await prdTasksDB.get(projectId)
      expect(persisted?.phase).toBe('error')
      expect(persisted?.error).toBe('测试错误')
    })

    it('clearTask 应该删除持久化记录', async () => {
      const store = usePRDGenerationStore.getState()
      const projectId = 'test-clear-project'

      store.startTask(projectId)
      await waitFor(100)

      await store.clearTask(projectId)

      const persisted = await prdTasksDB.get(projectId)
      expect(persisted).toBeUndefined()
    })
  })
})
