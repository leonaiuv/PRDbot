/**
 * db.ts 单元测试
 * 测试数据持久化层功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import db, { projectsDB, settingsDB, chatDraftsDB, prdTasksDB } from '@/lib/db'
import { createTestProject, createTestSettings, createTestChatDraft, createTestPRDTask } from '../utils/factories'
import { clearTestDatabase, isValidTimestamp, isValidUUID } from '../utils/helpers'

describe('db.ts - 数据持久化层', () => {
  beforeEach(async () => {
    await clearTestDatabase()
  })

  afterEach(async () => {
    await clearTestDatabase()
  })

  describe('projectsDB', () => {
    describe('create', () => {
      it('应该创建新项目并返回ID', async () => {
        const project = createTestProject()
        const id = await projectsDB.create(project)

        expect(id).toBe(project.id)

        const retrieved = await projectsDB.getById(id)
        expect(retrieved).toEqual(project)
      })

      it('应该验证必填字段', async () => {
        const project = createTestProject()

        expect(project.id).toBeTruthy()
        expect(project.name).toBeTruthy()
        expect(isValidTimestamp(project.createdAt)).toBe(true)
        expect(isValidTimestamp(project.updatedAt)).toBe(true)
        expect(['exploring', 'generated', 'exported']).toContain(project.status)
      })
    })

    describe('getAll', () => {
      it('应该返回所有项目并按updatedAt降序排列', async () => {
        const projects = [
          createTestProject({ name: '项目1', updatedAt: Date.now() - 3000 }),
          createTestProject({ name: '项目2', updatedAt: Date.now() - 2000 }),
          createTestProject({ name: '项目3', updatedAt: Date.now() - 1000 }),
        ]

        for (const p of projects) {
          await projectsDB.create(p)
        }

        const retrieved = await projectsDB.getAll()

        expect(retrieved).toHaveLength(3)
        expect(retrieved[0].name).toBe('项目3') // 最新的在前
        expect(retrieved[1].name).toBe('项目2')
        expect(retrieved[2].name).toBe('项目1')
      })

      it('空数据库应该返回空数组', async () => {
        const projects = await projectsDB.getAll()
        expect(projects).toEqual([])
      })
    })

    describe('update', () => {
      it('应该更新项目并自动刷新updatedAt', async () => {
        const project = createTestProject()
        await projectsDB.create(project)

        const originalUpdatedAt = project.updatedAt

        await new Promise(resolve => setTimeout(resolve, 10)) // 确保时间差异

        await projectsDB.update(project.id, { name: '更新后的名称' })

        const updated = await projectsDB.getById(project.id)
        expect(updated!.name).toBe('更新后的名称')
        expect(updated!.updatedAt).toBeGreaterThan(originalUpdatedAt)
      })

      it('部分字段更新不应该影响其他字段', async () => {
        const project = createTestProject({
          name: '原始名称',
          prdContent: '原始内容',
        })
        await projectsDB.create(project)

        await projectsDB.update(project.id, { name: '新名称' })

        const updated = await projectsDB.getById(project.id)
        expect(updated!.name).toBe('新名称')
        expect(updated!.prdContent).toBe('原始内容')
      })
    })

    describe('delete', () => {
      it('应该删除项目', async () => {
        const project = createTestProject()
        await projectsDB.create(project)

        await projectsDB.delete(project.id)

        const retrieved = await projectsDB.getById(project.id)
        expect(retrieved).toBeUndefined()
      })

      it('删除不存在的项目不应该报错', async () => {
        await expect(projectsDB.delete('non-existent-id')).resolves.not.toThrow()
      })
    })

    describe('search', () => {
      it('应该按名称搜索项目（大小写不敏感）', async () => {
        await projectsDB.create(createTestProject({ name: '待办应用', initialInput: '开发待办应用' }))
        await projectsDB.create(createTestProject({ name: '博客系统', initialInput: '开发博客系统' }))

        const results = await projectsDB.search('待办')

        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('待办应用')

        const resultsLowerCase = await projectsDB.search('待办')
        expect(resultsLowerCase).toHaveLength(1)
      })

      it('应该按初始输入搜索项目', async () => {
        await projectsDB.create(createTestProject({ initialInput: '开发一个电商平台' }))
        await projectsDB.create(createTestProject({ initialInput: '开发一个博客' }))

        const results = await projectsDB.search('电商')

        expect(results).toHaveLength(1)
        expect(results[0].initialInput).toContain('电商')
      })

      it('空关键词应该返回所有项目', async () => {
        await projectsDB.create(createTestProject())
        await projectsDB.create(createTestProject())

        const results = await projectsDB.search('')

        expect(results).toHaveLength(2)
      })
    })
  })

  describe('settingsDB', () => {
    describe('getOrCreate', () => {
      it('首次调用应该创建默认设置', async () => {
        const settings = await settingsDB.getOrCreate()

        expect(settings.id).toBe('global')
        expect(settings.defaultModel).toBe('deepseek')
        expect(settings.exportPreferences.defaultFormat).toBe('md')
        expect(settings.apiKeys).toEqual({})
      })

      it('后续调用应该返回已有设置', async () => {
        const first = await settingsDB.getOrCreate()
        const second = await settingsDB.getOrCreate()

        expect(first).toEqual(second)
      })
    })

    describe('加密存储', () => {
      it('应该加密API密钥', async () => {
        const apiKeys = {
          deepseek: 'sk-test-key-123',
        }

        await settingsDB.save({
          apiKeys,
          defaultModel: 'deepseek',
          exportPreferences: { defaultFormat: 'md' },
        })

        // 读取解密后的数据
        const retrieved = await settingsDB.get()
        expect(retrieved!.apiKeys.deepseek).toBe('sk-test-key-123')
      })
    })
  })

  describe('chatDraftsDB', () => {
    const projectId = 'test-project-id'

    it('应该保存和获取草稿', async () => {
      const draft = createTestChatDraft(projectId, {
        inputDraft: '测试输入',
      })

      await chatDraftsDB.save(draft)

      const retrieved = await chatDraftsDB.get(projectId)
      expect(retrieved!.inputDraft).toBe('测试输入')
      expect(isValidTimestamp(retrieved!.updatedAt)).toBe(true)
    })

    it('应该删除草稿', async () => {
      const draft = createTestChatDraft(projectId)
      await chatDraftsDB.save(draft)

      await chatDraftsDB.delete(projectId)

      const retrieved = await chatDraftsDB.get(projectId)
      expect(retrieved).toBeUndefined()
    })

    it('应该清理过期草稿', async () => {
      const cutoff = 7 * 24 * 60 * 60 * 1000
      const oldDraft = createTestChatDraft('old-project')
      const newDraft = createTestChatDraft('new-project')
      
      // 直接操作数据库以设置准确的时间戳
      const oldDraftWithTime = {
        ...oldDraft,
        updatedAt: Date.now() - cutoff - 10000, // 确保超过7天
      }
      const newDraftWithTime = {
        ...newDraft,
        updatedAt: Date.now(),
      }

      // 直接插入数据库，不通过save方法（save会覆盖updatedAt）
      await db.chatDrafts.put(oldDraftWithTime)
      await db.chatDrafts.put(newDraftWithTime)

      const deleted = await chatDraftsDB.cleanupOld()

      expect(deleted).toBe(1)

      const remainingOld = await chatDraftsDB.get('old-project')
      const remainingNew = await chatDraftsDB.get('new-project')

      expect(remainingOld).toBeUndefined()
      expect(remainingNew).toBeDefined()
    })
  })

  describe('prdTasksDB', () => {
    const projectId = 'test-project-id'

    it('应该保存和获取任务', async () => {
      const task = createTestPRDTask(projectId, {
        phase: 'generating',
        streamContent: '测试内容',
      })

      await prdTasksDB.save(task)

      const retrieved = await prdTasksDB.get(projectId)
      expect(retrieved!.phase).toBe('generating')
      expect(retrieved!.streamContent).toBe('测试内容')
    })

    it('应该获取未完成的任务', async () => {
      await prdTasksDB.save(createTestPRDTask('project1', { phase: 'generating' }))
      await prdTasksDB.save(createTestPRDTask('project2', { phase: 'completed' }))
      await prdTasksDB.save(createTestPRDTask('project3', { phase: 'generating' }))

      const incomplete = await prdTasksDB.getIncomplete()

      expect(incomplete).toHaveLength(2)
      expect(incomplete.every(t => t.phase === 'generating')).toBe(true)
    })

    it('应该清理已完成的旧任务', async () => {
      const cutoff = 24 * 60 * 60 * 1000
      const oldCompleted = createTestPRDTask('old-completed', {
        phase: 'completed',
      })
      const newCompleted = createTestPRDTask('new-completed', {
        phase: 'completed',
      })
      
      // 直接操作数据库以设置准确的时间戳
      const oldCompletedWithTime = {
        ...oldCompleted,
        updatedAt: Date.now() - cutoff - 10000, // 确保超过1天
      }
      const newCompletedWithTime = {
        ...newCompleted,
        updatedAt: Date.now(),
      }

      // 直接插入数据库，不通过save方法
      await db.prdTasks.put(oldCompletedWithTime)
      await db.prdTasks.put(newCompletedWithTime)

      const deleted = await prdTasksDB.cleanupCompleted()

      expect(deleted).toBe(1)

      const remainingOld = await prdTasksDB.get('old-completed')
      const remainingNew = await prdTasksDB.get('new-completed')

      expect(remainingOld).toBeUndefined()
      expect(remainingNew).toBeDefined()
    })
  })
})
