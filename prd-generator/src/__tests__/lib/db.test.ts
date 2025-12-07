/**
 * db.ts 单元测试
 * 测试数据持久化层功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import db, { projectsDB, settingsDB, chatDraftsDB, prdTasksDB, translationTasksDB, translationCacheDB, analysisResultsDB } from '@/lib/db'
import { createTestProject, createTestChatDraft, createTestPRDTask, createTestTranslationTask, createTestTranslationCache, createTestAnalysisResult, TEST_ANALYSIS_TYPES } from '../utils/factories'
import { clearTestDatabase, isValidTimestamp } from '../utils/helpers'

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

  // ========== 翻译任务持久化测试 ==========
  describe('translationTasksDB', () => {
    const projectId = 'test-project-id'

    describe('save和get', () => {
      it('应该保存和获取翻译任务', async () => {
        const task = createTestTranslationTask(projectId, 'en', {
          phase: 'translating',
          progress: 50,
        })

        await translationTasksDB.save(task)

        const retrieved = await translationTasksDB.get(task.id)
        expect(retrieved).toBeDefined()
        expect(retrieved!.projectId).toBe(projectId)
        expect(retrieved!.langCode).toBe('en')
        expect(retrieved!.phase).toBe('translating')
        expect(retrieved!.progress).toBe(50)
      })

      it('应该自动更新updatedAt', async () => {
        const task = createTestTranslationTask(projectId, 'ja')
        const originalUpdatedAt = task.updatedAt

        await new Promise(resolve => setTimeout(resolve, 10))
        await translationTasksDB.save(task)

        const retrieved = await translationTasksDB.get(task.id)
        expect(retrieved!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
      })
    })

    describe('getByProject', () => {
      it('应该获取项目的所有翻译任务', async () => {
        await translationTasksDB.save(createTestTranslationTask(projectId, 'en'))
        await translationTasksDB.save(createTestTranslationTask(projectId, 'ja'))
        await translationTasksDB.save(createTestTranslationTask('other-project', 'ko'))

        const tasks = await translationTasksDB.getByProject(projectId)

        expect(tasks).toHaveLength(2)
        expect(tasks.every(t => t.projectId === projectId)).toBe(true)
      })

      it('空项目应该返回空数组', async () => {
        const tasks = await translationTasksDB.getByProject('non-existent-project')
        expect(tasks).toEqual([])
      })
    })

    describe('getInProgress', () => {
      it('应该获取所有进行中的任务', async () => {
        await translationTasksDB.save(createTestTranslationTask(projectId, 'en', { phase: 'translating' }))
        await translationTasksDB.save(createTestTranslationTask(projectId, 'ja', { phase: 'completed' }))
        await translationTasksDB.save(createTestTranslationTask('other', 'ko', { phase: 'translating' }))

        const inProgress = await translationTasksDB.getInProgress()

        expect(inProgress).toHaveLength(2)
        expect(inProgress.every(t => t.phase === 'translating')).toBe(true)
      })
    })

    describe('delete', () => {
      it('应该删除翻译任务', async () => {
        const task = createTestTranslationTask(projectId, 'en')
        await translationTasksDB.save(task)

        await translationTasksDB.delete(task.id)

        const retrieved = await translationTasksDB.get(task.id)
        expect(retrieved).toBeUndefined()
      })

      it('删除不存在的任务不应该报错', async () => {
        await expect(translationTasksDB.delete('non-existent')).resolves.not.toThrow()
      })
    })

    describe('cleanupCompleted', () => {
      it('应该清理1天前已完成的任务', async () => {
        const cutoff = 24 * 60 * 60 * 1000

        const oldTask = createTestTranslationTask('old-project', 'en', {
          id: 'old-project_en',
          phase: 'completed',
        })
        const newTask = createTestTranslationTask('new-project', 'ja', {
          id: 'new-project_ja',
          phase: 'completed',
        })

        // 直接操作数据库以设置准确的时间戳
        const oldTaskWithTime = {
          ...oldTask,
          updatedAt: Date.now() - cutoff - 10000,
        }
        const newTaskWithTime = {
          ...newTask,
          updatedAt: Date.now(),
        }

        await db.translationTasks.put(oldTaskWithTime)
        await db.translationTasks.put(newTaskWithTime)

        const deleted = await translationTasksDB.cleanupCompleted()

        expect(deleted).toBe(1)

        const remainingOld = await translationTasksDB.get('old-project_en')
        const remainingNew = await translationTasksDB.get('new-project_ja')

        expect(remainingOld).toBeUndefined()
        expect(remainingNew).toBeDefined()
      })
    })
  })

  // ========== 翻译缓存测试 ==========
  describe('translationCacheDB', () => {
    const projectId = 'test-project-id'

    describe('save和get', () => {
      it('应该保存和获取翻译缓存', async () => {
        const cache = createTestTranslationCache(projectId, 'en', {
          translatedContent: '# English PRD\n\nContent here.',
        })

        await translationCacheDB.save(cache)

        const retrieved = await translationCacheDB.get(cache.id)
        expect(retrieved).toBeDefined()
        expect(retrieved!.translatedContent).toBe('# English PRD\n\nContent here.')
      })

      it('应该自动设置createdAt和updatedAt', async () => {
        const now = Date.now()
        const cache = createTestTranslationCache(projectId, 'ja')
        // @ts-expect-error - 为测试目的删除时间戳
        delete cache.createdAt
        // @ts-expect-error - 为测试目的删除时间戳
        delete cache.updatedAt

        await translationCacheDB.save(cache)

        const retrieved = await translationCacheDB.get(cache.id)
        expect(retrieved!.createdAt).toBeGreaterThanOrEqual(now)
        expect(retrieved!.updatedAt).toBeGreaterThanOrEqual(now)
      })
    })

    describe('getByHashAndLang', () => {
      it('应该根据内容hash和语言代码查找缓存', async () => {
        const cache = createTestTranslationCache(projectId, 'en', {
          contentHash: 'unique-hash-123',
        })
        await translationCacheDB.save(cache)

        const found = await translationCacheDB.getByHashAndLang('unique-hash-123', 'en')

        expect(found).toBeDefined()
        expect(found!.id).toBe(cache.id)
      })

      it('不匹配的hash应该返回undefined', async () => {
        const cache = createTestTranslationCache(projectId, 'en', {
          contentHash: 'hash-1',
        })
        await translationCacheDB.save(cache)

        const notFound = await translationCacheDB.getByHashAndLang('hash-2', 'en')
        expect(notFound).toBeUndefined()
      })

      it('不匹配的语言应该返回undefined', async () => {
        const cache = createTestTranslationCache(projectId, 'en', {
          contentHash: 'hash-1',
        })
        await translationCacheDB.save(cache)

        const notFound = await translationCacheDB.getByHashAndLang('hash-1', 'ja')
        expect(notFound).toBeUndefined()
      })
    })

    describe('getByProject', () => {
      it('应该获取项目的所有缓存', async () => {
        await translationCacheDB.save(createTestTranslationCache(projectId, 'en', { id: 'cache1', contentHash: 'h1' }))
        await translationCacheDB.save(createTestTranslationCache(projectId, 'ja', { id: 'cache2', contentHash: 'h2' }))
        await translationCacheDB.save(createTestTranslationCache('other-project', 'ko', { id: 'cache3', contentHash: 'h3' }))

        const caches = await translationCacheDB.getByProject(projectId)

        expect(caches).toHaveLength(2)
        expect(caches.every(c => c.projectId === projectId)).toBe(true)
      })
    })

    describe('deleteByProject', () => {
      it('应该删除项目的所有缓存', async () => {
        await translationCacheDB.save(createTestTranslationCache(projectId, 'en', { id: 'cache1', contentHash: 'h1' }))
        await translationCacheDB.save(createTestTranslationCache(projectId, 'ja', { id: 'cache2', contentHash: 'h2' }))
        await translationCacheDB.save(createTestTranslationCache('other-project', 'ko', { id: 'cache3', contentHash: 'h3' }))

        const deleted = await translationCacheDB.deleteByProject(projectId)

        expect(deleted).toBe(2)

        const remaining = await translationCacheDB.getByProject(projectId)
        expect(remaining).toHaveLength(0)

        const otherRemaining = await translationCacheDB.getByProject('other-project')
        expect(otherRemaining).toHaveLength(1)
      })
    })

    describe('cleanupOld', () => {
      it('应该清理7天前的过期缓存', async () => {
        const cutoff = 7 * 24 * 60 * 60 * 1000

        const oldCache = createTestTranslationCache('old', 'en', {
          id: 'old-cache',
          contentHash: 'old-hash',
        })
        const newCache = createTestTranslationCache('new', 'ja', {
          id: 'new-cache',
          contentHash: 'new-hash',
        })

        // 直接操作数据库以设置准确的时间戳
        const oldCacheWithTime = {
          ...oldCache,
          updatedAt: Date.now() - cutoff - 10000,
          createdAt: Date.now() - cutoff - 10000,
        }
        const newCacheWithTime = {
          ...newCache,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        }

        await db.translationCache.put(oldCacheWithTime)
        await db.translationCache.put(newCacheWithTime)

        const deleted = await translationCacheDB.cleanupOld()

        expect(deleted).toBe(1)

        const remainingOld = await translationCacheDB.get('old-cache')
        const remainingNew = await translationCacheDB.get('new-cache')

        expect(remainingOld).toBeUndefined()
        expect(remainingNew).toBeDefined()
      })
    })

    describe('缓存命中逻辑', () => {
      it('相同内容相同语言应该命中缓存', async () => {
        const contentHash = 'same-content-hash'
        const cache = createTestTranslationCache(projectId, 'en', {
          id: `${contentHash}_en`,
          contentHash,
          translatedContent: 'Cached translation',
        })
        await translationCacheDB.save(cache)

        // 第一次查询
        const hit1 = await translationCacheDB.getByHashAndLang(contentHash, 'en')
        expect(hit1).toBeDefined()
        expect(hit1!.translatedContent).toBe('Cached translation')

        // 第二次查询（应该缓存命中）
        const hit2 = await translationCacheDB.getByHashAndLang(contentHash, 'en')
        expect(hit2).toBeDefined()
        expect(hit2!.id).toBe(hit1!.id)
      })

      it('相同内容不同语言应该分别缓存', async () => {
        const contentHash = 'same-content-hash'
        await translationCacheDB.save(createTestTranslationCache(projectId, 'en', {
          id: `${contentHash}_en`,
          contentHash,
          translatedContent: 'English version',
        }))
        await translationCacheDB.save(createTestTranslationCache(projectId, 'ja', {
          id: `${contentHash}_ja`,
          contentHash,
          translatedContent: 'Japanese version',
        }))

        const enCache = await translationCacheDB.getByHashAndLang(contentHash, 'en')
        const jaCache = await translationCacheDB.getByHashAndLang(contentHash, 'ja')

        expect(enCache!.translatedContent).toBe('English version')
        expect(jaCache!.translatedContent).toBe('Japanese version')
      })

      it('不同内容相同语言应该不命中缓存', async () => {
        await translationCacheDB.save(createTestTranslationCache(projectId, 'en', {
          id: 'hash1_en',
          contentHash: 'hash1',
          translatedContent: 'Version 1',
        }))

        // 内容变化后，不应该命中旧缓存
        const miss = await translationCacheDB.getByHashAndLang('hash2', 'en')
        expect(miss).toBeUndefined()
      })
    })
  })

  // ========== AI分析结果测试 ==========
  describe('analysisResultsDB', () => {
    const projectId = 'test-project-analysis'

    describe('基本 CRUD 操作', () => {
      it('应该保存和获取分析结果', async () => {
        const result = createTestAnalysisResult(projectId, 'optimize')
        await analysisResultsDB.save(result)

        const retrieved = await analysisResultsDB.get(projectId, 'optimize')

        expect(retrieved).toBeDefined()
        expect(retrieved!.id).toBe(`${projectId}_optimize`)
        expect(retrieved!.type).toBe('optimize')
        expect(retrieved!.content).toContain('AI优化建议')
      })

      it('应该更新已存在的分析结果', async () => {
        const result = createTestAnalysisResult(projectId, 'score', {
          content: '旧内容',
        })
        await analysisResultsDB.save(result)

        const originalUpdatedAt = result.updatedAt
        await new Promise(resolve => setTimeout(resolve, 10))

        await analysisResultsDB.save({
          ...result,
          content: '新内容',
        })

        const updated = await analysisResultsDB.get(projectId, 'score')
        expect(updated!.content).toBe('新内容')
        expect(updated!.updatedAt).toBeGreaterThan(originalUpdatedAt)
      })

      it('应该删除分析结果', async () => {
        const result = createTestAnalysisResult(projectId, 'competitor')
        await analysisResultsDB.save(result)

        await analysisResultsDB.delete(result.id)

        const deleted = await analysisResultsDB.get(projectId, 'competitor')
        expect(deleted).toBeUndefined()
      })

      it('删除不存在的结果不应该报错', async () => {
        await expect(analysisResultsDB.delete('non-existent-id')).resolves.not.toThrow()
      })
    })

    describe('项目级别操作', () => {
      it('应该获取项目的所有分析结果', async () => {
        // 保存多种类型的分析结果
        for (const type of TEST_ANALYSIS_TYPES) {
          await analysisResultsDB.save(createTestAnalysisResult(projectId, type))
        }

        const results = await analysisResultsDB.getByProject(projectId)

        expect(results).toHaveLength(4)
        expect(results.map(r => r.type).sort()).toEqual(['competitor', 'diagram', 'optimize', 'score'])
      })

      it('应该删除项目的所有分析结果', async () => {
        for (const type of TEST_ANALYSIS_TYPES) {
          await analysisResultsDB.save(createTestAnalysisResult(projectId, type))
        }

        const deletedCount = await analysisResultsDB.deleteByProject(projectId)

        expect(deletedCount).toBe(4)

        const remaining = await analysisResultsDB.getByProject(projectId)
        expect(remaining).toHaveLength(0)
      })

      it('不同项目的分析结果应该独立', async () => {
        const project1 = 'project-1'
        const project2 = 'project-2'

        await analysisResultsDB.save(createTestAnalysisResult(project1, 'optimize'))
        await analysisResultsDB.save(createTestAnalysisResult(project2, 'optimize'))

        const results1 = await analysisResultsDB.getByProject(project1)
        const results2 = await analysisResultsDB.getByProject(project2)

        expect(results1).toHaveLength(1)
        expect(results2).toHaveLength(1)
        expect(results1[0].projectId).toBe(project1)
        expect(results2[0].projectId).toBe(project2)
      })
    })

    describe('过期清理', () => {
      it('应该清理30天前的分析结果', async () => {
        const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000 // 31天前
        const newTime = Date.now() - 1 * 24 * 60 * 60 * 1000  // 1天前

        // 直接操作数据库插入过期数据
        await db.analysisResults.put({
          ...createTestAnalysisResult(projectId, 'optimize'),
          id: 'old-result',
          updatedAt: oldTime,
          createdAt: oldTime,
        })
        await db.analysisResults.put({
          ...createTestAnalysisResult(projectId, 'score'),
          id: 'new-result',
          updatedAt: newTime,
          createdAt: newTime,
        })

        const deleted = await analysisResultsDB.cleanupOld()

        expect(deleted).toBe(1)

        const remainingOld = await db.analysisResults.get('old-result')
        const remainingNew = await db.analysisResults.get('new-result')

        expect(remainingOld).toBeUndefined()
        expect(remainingNew).toBeDefined()
      })

      it('没有过期数据时应该返回0', async () => {
        await analysisResultsDB.save(createTestAnalysisResult(projectId, 'optimize'))

        const deleted = await analysisResultsDB.cleanupOld()

        expect(deleted).toBe(0)
      })
    })

    describe('PRD内容Hash管理', () => {
      it('应该保存PRD内容Hash', async () => {
        const result = createTestAnalysisResult(projectId, 'optimize', {
          prdContentHash: 'custom-hash-123',
        })
        await analysisResultsDB.save(result)

        const retrieved = await analysisResultsDB.get(projectId, 'optimize')
        expect(retrieved!.prdContentHash).toBe('custom-hash-123')
      })

      it('更新时应该更新Hash', async () => {
        const result = createTestAnalysisResult(projectId, 'score', {
          prdContentHash: 'old-hash',
        })
        await analysisResultsDB.save(result)

        await analysisResultsDB.save({
          ...result,
          prdContentHash: 'new-hash',
        })

        const updated = await analysisResultsDB.get(projectId, 'score')
        expect(updated!.prdContentHash).toBe('new-hash')
      })
    })

    describe('边界场景', () => {
      it('空项目应该返回空数组', async () => {
        const results = await analysisResultsDB.getByProject('non-existent-project')
        expect(results).toEqual([])
      })

      it('不存在的分析类型应该返回undefined', async () => {
        await analysisResultsDB.save(createTestAnalysisResult(projectId, 'optimize'))

        const result = await analysisResultsDB.get(projectId, 'score')
        expect(result).toBeUndefined()
      })

      it('应该支持大量内容存储', async () => {
        const largeContent = '测试内容'.repeat(10000) // 约4万字符
        const result = createTestAnalysisResult(projectId, 'optimize', {
          content: largeContent,
        })
        await analysisResultsDB.save(result)

        const retrieved = await analysisResultsDB.get(projectId, 'optimize')
        expect(retrieved!.content).toBe(largeContent)
        expect(retrieved!.content.length).toBe(40000)
      })

      it('应该支持特殊字符', async () => {
        const specialContent = '# 标题\n- 列表\n```mermaid\ngraph TD\n```\n中文内容 & <script>'
        const result = createTestAnalysisResult(projectId, 'diagram', {
          content: specialContent,
        })
        await analysisResultsDB.save(result)

        const retrieved = await analysisResultsDB.get(projectId, 'diagram')
        expect(retrieved!.content).toBe(specialContent)
      })

      it('并发保存应该正确处理', async () => {
        const saves = TEST_ANALYSIS_TYPES.map(type =>
          analysisResultsDB.save(createTestAnalysisResult(projectId, type))
        )

        await Promise.all(saves)

        const results = await analysisResultsDB.getByProject(projectId)
        expect(results).toHaveLength(4)
      })
    })
  })
})
