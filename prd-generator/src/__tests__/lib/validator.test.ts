/**
 * validator.ts 单元测试
 * 测试AI响应格式校验功能
 */

import { describe, it, expect } from '@jest/globals'
import {
  validateAIResponse,
  extractJSON,
  buildRetryPrompt,
  checkCompleteness,
  aggregateSSEStream,
} from '@/lib/validator'

describe('validator.ts - AI响应校验模块', () => {
  describe('extractJSON', () => {
    it('应该从代码块中提取JSON', () => {
      const text = '```json\n{"questions": [], "meta": {}}\n```'
      const { json, textContent } = extractJSON(text)

      expect(json).toBe('{"questions": [], "meta": {}}')
      expect(textContent).toBe('')
    })

    it('应该从代码块中提取JSON（无json标记）', () => {
      const text = '```\n{"questions": [], "meta": {}}\n```'
      const { json, textContent } = extractJSON(text)

      expect(json).toBe('{"questions": [], "meta": {}}')
    })

    it('应该从裸JSON中提取', () => {
      const text = '{"questions": [], "meta": {}}'
      const { json, textContent } = extractJSON(text)

      expect(json).toBe('{"questions": [], "meta": {}}')
      expect(textContent).toBe('')
    })

    it('应该从嵌入文本中提取JSON', () => {
      const text = '这是一些说明文字 {"questions": [], "meta": {}} 结束'
      const { json, textContent } = extractJSON(text)

      expect(json).toContain('{"questions": [], "meta": {}}')
      expect(textContent).toContain('这是一些说明文字')
      expect(textContent).toContain('结束')
    })

    it('未找到JSON时应该返回null', () => {
      const text = '没有JSON的纯文本'
      const { json, textContent } = extractJSON(text)

      expect(json).toBeNull()
      expect(textContent).toBe('没有JSON的纯文本')
    })
  })

  describe('validateAIResponse', () => {
    it('应该验证有效的AI响应', () => {
      const validResponse = JSON.stringify({
        questions: [
          {
            id: 'q_test_1',
            question: '测试问题？',
            type: 'radio',
            options: [
              { value: 'opt1', label: '选项1' },
              { value: 'opt2', label: '选项2' },
            ],
            required: true,
          },
        ],
        meta: {
          phase: 'basic',
          progress: 10,
          canGeneratePRD: false,
        },
      })

      const result = validateAIResponse(validResponse)

      expect(result.valid).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.questions).toHaveLength(1)
    })

    it('应该拒绝问题数量过多的响应', () => {
      const tooManyQuestions = {
        questions: Array(10).fill({
          id: 'q_test',
          question: '问题',
          type: 'radio',
          options: [{ value: '1', label: '1' }, { value: '2', label: '2' }],
        }),
        meta: {
          phase: 'basic',
          progress: 10,
          canGeneratePRD: false,
        },
      }

      const result = validateAIResponse(JSON.stringify(tooManyQuestions))

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('应该拒绝选项数量不足的问题', () => {
      const insufficientOptions = {
        questions: [
          {
            id: 'q_test_1',
            question: '测试问题？',
            type: 'radio',
            options: [{ value: 'opt1', label: '选项1' }], // 只有1个选项
          },
        ],
        meta: {
          phase: 'basic',
          progress: 10,
          canGeneratePRD: false,
        },
      }

      const result = validateAIResponse(JSON.stringify(insufficientOptions))

      expect(result.valid).toBe(false)
    })

    it('应该拒绝无效的type枚举值', () => {
      const invalidType = {
        questions: [
          {
            id: 'q_test_1',
            question: '测试问题？',
            type: 'invalid_type',
            options: [{ value: '1', label: '1' }, { value: '2', label: '2' }],
          },
        ],
        meta: {
          phase: 'basic',
          progress: 10,
          canGeneratePRD: false,
        },
      }

      const result = validateAIResponse(JSON.stringify(invalidType))

      expect(result.valid).toBe(false)
    })

    it('应该处理JSON解析错误', () => {
      const invalidJSON = 'not a valid json {{{['

      const result = validateAIResponse(invalidJSON)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('未能从响应中提取到有效的JSON结构')
    })
  })

  describe('buildRetryPrompt', () => {
    it('应该生成重试提示词', () => {
      const errors = ['questions: 至少需要1个问题', 'meta.progress: 必须是数字']

      const prompt = buildRetryPrompt(errors)

      expect(prompt).toContain('格式不正确')
      expect(prompt).toContain('JSON格式')
      expect(prompt).toContain(errors[0])
      expect(prompt).toContain(errors[1])
    })

    it('应该限制错误数量（最多3个）', () => {
      const errors = ['错误1', '错误2', '错误3', '错误4', '错误5']

      const prompt = buildRetryPrompt(errors)

      expect(prompt).toContain('错误1')
      expect(prompt).toContain('错误2')
      expect(prompt).toContain('错误3')
      expect(prompt).not.toContain('错误4')
      expect(prompt).not.toContain('错误5')
    })
  })

  describe('checkCompleteness', () => {
    it('应该检查完整的响应', () => {
      const data = {
        questions: [
          {
            id: 'q1',
            question: '问题1',
            type: 'radio' as const,
            options: [
              { value: '1', label: '选项1' },
              { value: '2', label: '选项2' },
              { value: '3', label: '选项3' },
            ],
            required: true,
          },
        ],
        meta: {
          phase: 'basic' as const,
          progress: 50,
          canGeneratePRD: false,
        },
      }

      const result = checkCompleteness(data)

      expect(result.complete).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('应该警告选项过少', () => {
      const data = {
        questions: [
          {
            id: 'q1',
            question: '问题1',
            type: 'radio' as const,
            options: [
              { value: '1', label: '选项1' },
              { value: '2', label: '选项2' },
            ],
            required: true,
          },
        ],
        meta: {
          phase: 'basic' as const,
          progress: 50,
          canGeneratePRD: false,
        },
      }

      const result = checkCompleteness(data)

      expect(result.complete).toBe(false)
      expect(result.warnings.some(w => w.includes('选项少于3个'))).toBe(true)
    })
  })

  describe('aggregateSSEStream', () => {
    it('应该聚合SSE流式响应', async () => {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      const reader = stream.getReader()
      const content = await aggregateSSEStream(reader)

      expect(content).toBe('你好')
    })

    it('应该正确处理多字节UTF-8字符', async () => {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"🚀"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"测试"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      const reader = stream.getReader()
      const content = await aggregateSSEStream(reader)

      expect(content).toBe('🚀测试')
    })

    it('应该忽略无效的JSON行', async () => {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"正常"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: invalid json\n\n'))
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"内容"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      const reader = stream.getReader()
      const content = await aggregateSSEStream(reader)

      expect(content).toBe('正常内容')
    })
  })
})
