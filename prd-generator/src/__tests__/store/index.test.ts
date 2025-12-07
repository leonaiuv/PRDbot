/**
 * store/index.ts 单元测试
 * 测试状态管理层功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { act } from '@testing-library/react'
import { useProjectStore, useSettingsStore, useChatStore, usePRDGenerationStore } from '@/store'
import { projectsDB, settingsDB, prdTasksDB } from '@/lib/db'
import { createTestProject, createTestSettings, createTestMessage, createTestSelector } from '../utils/factories'
import { clearTestDatabase } from '../utils/helpers'
import type { Project, ConversationMessage } from '@/types'

describe('状态管理层测试', () => {
  beforeEach(async () => {
    await clearTestDatabase()
  })

  afterEach(async () => {
    await clearTestDatabase()
    // 重置所有store状态
    useProjectStore.setState({ projects: [], currentProjectId: null, isLoading: false, searchKeyword: '' })
    useSettingsStore.setState({ settings: null, isLoading: false })
    useChatStore.setState({ tasks: {} })
    usePRDGenerationStore.setState({ tasks: {}, contentChunks: {} })
  })

  describe('useProjectStore', () => {
    describe('派生状态一致性', () => {
      it('getCurrentProject应该从projects数组派生', async () => {
        const store = useProjectStore.getState()
        const project1 = createTestProject({ name: '项目1' })
        const project2 = createTestProject({ name: '项目2' })

        await projectsDB.create(project1)
        await projectsDB.create(project2)

        // 加载项目列表
        await store.loadProjects()
        
        // 设置当前项目ID
        useProjectStore.setState({ currentProjectId: project1.id })

        // 验证派生状态
        const currentProject = store.getCurrentProject()
        expect(currentProject?.id).toBe(project1.id)
        expect(currentProject?.name).toBe('项目1')
      })

      it('currentProjectId变更时currentProject应自动更新', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject()
        await projectsDB.create(project)
        await store.loadProjects()

        useProjectStore.setState({ currentProjectId: project.id })
        expect(store.getCurrentProject()?.id).toBe(project.id)

        useProjectStore.setState({ currentProjectId: null })
        expect(store.getCurrentProject()).toBeNull()
      })

      it('projects数组变更时currentProject应同步更新', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject({ name: '原始名称' })
        await projectsDB.create(project)
        await store.loadProjects()
        useProjectStore.setState({ currentProjectId: project.id })

        // 更新projects数组
        await store.updateProject(project.id, { name: '更新后的名称' })

        // 验证currentProject同步更新
        const currentProject = store.getCurrentProject()
        expect(currentProject?.name).toBe('更新后的名称')
      })
    })

    describe('状态更新原子性', () => {
      it('addMessage应该在单次set调用中更新projects', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject()
        await projectsDB.create(project)
        await store.loadProjects()
        await store.loadProject(project.id)

        const message: ConversationMessage = createTestMessage({
          role: 'user',
          content: '测试消息',
        })

        await store.addMessage(message)

        const currentProject = store.getCurrentProject()
        expect(currentProject?.conversation).toHaveLength(1)
        expect(currentProject?.conversation[0].content).toBe('测试消息')
        expect(currentProject?.metadata.questionCount).toBe(1)
      })

      it('updatePRDContent应该原子性更新', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject()
        await projectsDB.create(project)
        await store.loadProjects()
        await store.loadProject(project.id)

        const content = '# PRD内容\n测试内容'
        await store.updatePRDContent(content)

        const currentProject = store.getCurrentProject()
        expect(currentProject?.prdContent).toBe(content)
      })

      it('setProjectStatus应该原子性更新', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject({ status: 'exploring' })
        await projectsDB.create(project)
        await store.loadProjects()
        await store.loadProject(project.id)

        await store.setProjectStatus('generated')

        const currentProject = store.getCurrentProject()
        expect(currentProject?.status).toBe('generated')
      })
    })

    describe('createProject', () => {
      it('应该创建新项目并添加到列表', async () => {
        const store = useProjectStore.getState()
        
        const project = await store.createProject('测试项目', '开发待办应用')

        expect(project.name).toBe('测试项目')
        expect(project.initialInput).toBe('开发待办应用')
        expect(project.status).toBe('exploring')
        expect(project.conversation).toEqual([])
        expect(project.prdContent).toBe('')
        
        const { projects } = useProjectStore.getState()
        expect(projects).toHaveLength(1)
        expect(projects[0].id).toBe(project.id)
      })
    })

    describe('loadProject', () => {
      it('应该确保项目在列表中再设置currentProjectId', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject()
        await projectsDB.create(project)

        await store.loadProject(project.id)

        const { projects, currentProjectId } = useProjectStore.getState()
        expect(currentProjectId).toBe(project.id)
        expect(projects.some(p => p.id === project.id)).toBe(true)
      })
    })

    describe('deleteProject', () => {
      it('应该删除项目并清除currentProjectId', async () => {
        const store = useProjectStore.getState()
        const project = createTestProject()
        await projectsDB.create(project)
        await store.loadProjects()
        useProjectStore.setState({ currentProjectId: project.id })

        await store.deleteProject(project.id)

        const { projects, currentProjectId } = useProjectStore.getState()
        expect(projects).toHaveLength(0)
        expect(currentProjectId).toBeNull()
      })
    })
  })

  describe('useSettingsStore', () => {
    describe('密钥管理', () => {
      it('应该正确加载和解密API密钥', async () => {
        const store = useSettingsStore.getState()
        
        // 保存加密的密钥
        await settingsDB.save({
          apiKeys: { deepseek: 'sk-test-key-123' },
          defaultModel: 'deepseek',
          exportPreferences: { defaultFormat: 'md' },
        })

        // 加载设置
        await store.loadSettings()

        const { settings } = useSettingsStore.getState()
        expect(settings?.apiKeys.deepseek).toBe('sk-test-key-123')
      })

      it('setApiKey应该更新密钥并保存', async () => {
        const store = useSettingsStore.getState()
        await store.loadSettings()

        await store.setApiKey('deepseek', 'sk-new-key-456')

        const { settings } = useSettingsStore.getState()
        expect(settings?.apiKeys.deepseek).toBe('sk-new-key-456')

        // 验证持久化
        const savedSettings = await settingsDB.get()
        expect(savedSettings?.apiKeys.deepseek).toBe('sk-new-key-456')
      })

      it('getApiKey应该返回指定provider的密钥', async () => {
        const store = useSettingsStore.getState()
        await settingsDB.save({
          apiKeys: { deepseek: 'sk-deepseek', openai: 'sk-openai' },
          defaultModel: 'deepseek',
          exportPreferences: { defaultFormat: 'md' },
        })
        await store.loadSettings()

        expect(store.getApiKey('deepseek')).toBe('sk-deepseek')
        expect(store.getApiKey('openai')).toBe('sk-openai')
        expect(store.getApiKey('nonexistent')).toBeUndefined()
      })
    })

    describe('updateSettings', () => {
      it('应该更新设置并持久化', async () => {
        const store = useSettingsStore.getState()
        await store.loadSettings()

        await store.updateSettings({ defaultModel: 'openai' })

        const { settings } = useSettingsStore.getState()
        expect(settings?.defaultModel).toBe('openai')

        // 验证持久化
        const savedSettings = await settingsDB.get()
        expect(savedSettings?.defaultModel).toBe('openai')
      })
    })
  })

  describe('useChatStore', () => {
    const projectId = 'test-project-id'

    describe('按项目隔离', () => {
      it('不同项目的生成状态应该互不影响', () => {
        const store = useChatStore.getState()

        store.startGeneration('project1')
        store.startGeneration('project2')

        const task1 = store.getTask('project1')
        const task2 = store.getTask('project2')

        expect(task1.projectId).toBe('project1')
        expect(task2.projectId).toBe('project2')
        expect(task1.generationPhase).toBe('generating')
        expect(task2.generationPhase).toBe('generating')
      })

      it('getTask应该返回正确的任务或默认状态', () => {
        const store = useChatStore.getState()

        // 不存在的任务应返回默认状态
        const defaultTask = store.getTask('nonexistent-project')
        expect(defaultTask.generationPhase).toBe('idle')
        expect(defaultTask.projectId).toBe('nonexistent-project')

        // 已存在的任务应返回实际状态
        store.startGeneration(projectId)
        const actualTask = store.getTask(projectId)
        expect(actualTask.generationPhase).toBe('generating')
      })
    })

    describe('生成阶段管理', () => {
      it('startGeneration应该创建AbortController并设置状态', () => {
        const store = useChatStore.getState()

        const abortController = store.startGeneration(projectId)

        expect(abortController).toBeInstanceOf(AbortController)
        
        const task = store.getTask(projectId)
        expect(task.generationPhase).toBe('generating')
        expect(task.currentStep).toBe('understanding')
        expect(task.stepIndex).toBe(0)
        expect(task.canCancel).toBe(true)
        expect(task.abortController).toBe(abortController)
      })

      it('setGenerationPhase应该更新阶段', () => {
        const store = useChatStore.getState()
        store.startGeneration(projectId)

        store.setGenerationPhase(projectId, 'interactive')

        const task = store.getTask(projectId)
        expect(task.generationPhase).toBe('interactive')
      })

      it('advanceStep应该推进步骤', () => {
        const store = useChatStore.getState()
        store.startGeneration(projectId)

        expect(store.getTask(projectId).currentStep).toBe('understanding')

        store.advanceStep(projectId)
        expect(store.getTask(projectId).currentStep).toBe('generating')

        store.advanceStep(projectId)
        expect(store.getTask(projectId).currentStep).toBe('building')

        store.advanceStep(projectId)
        expect(store.getTask(projectId).currentStep).toBe('validating')

        // 已到最后一步，不应继续推进
        store.advanceStep(projectId)
        expect(store.getTask(projectId).currentStep).toBe('validating')
      })

      it('setPendingSelectors应该设置选择器和元数据', () => {
        const store = useChatStore.getState()
        const selectors = [createTestSelector(), createTestSelector()]
        const meta = {
          phase: 'basic' as const,
          progress: 20,
          canGeneratePRD: false,
          suggestedNextTopic: '核心功能',
        }

        store.setPendingSelectors(projectId, selectors, meta)

        const task = store.getTask(projectId)
        expect(task.pendingSelectors).toHaveLength(2)
        expect(task.questionMeta).toEqual(meta)
      })

      it('completeGeneration应该完成生成并清理状态', () => {
        const store = useChatStore.getState()
        store.startGeneration(projectId)

        store.completeGeneration(projectId)

        const task = store.getTask(projectId)
        expect(task.generationPhase).toBe('interactive')
        expect(task.canCancel).toBe(false)
        expect(task.isStreaming).toBe(false)
        expect(task.abortController).toBeNull()
      })
    })

    describe('AbortController管理', () => {
      it('cancelGeneration应该调用abort并重置状态', () => {
        const store = useChatStore.getState()
        const abortController = store.startGeneration(projectId)
        const abortSpy = jest.spyOn(abortController, 'abort')

        store.cancelGeneration(projectId)

        expect(abortSpy).toHaveBeenCalled()
        
        const task = store.getTask(projectId)
        expect(task.generationPhase).toBe('idle')
        expect(task.isStreaming).toBe(false)
        expect(task.streamContent).toBe('')
        expect(task.pendingSelectors).toEqual([])
      })

      it('abortAndReset应该中断并重置为默认状态', () => {
        const store = useChatStore.getState()
        const abortController = store.startGeneration(projectId)
        const abortSpy = jest.spyOn(abortController, 'abort')

        store.abortAndReset(projectId)

        expect(abortSpy).toHaveBeenCalled()
        
        const task = store.getTask(projectId)
        expect(task.generationPhase).toBe('idle')
        expect(task.startTime).toBe(0)
      })

      it('getAbortSignal应该返回正确的signal', () => {
        const store = useChatStore.getState()
        const abortController = store.startGeneration(projectId)

        const signal = store.getAbortSignal(projectId)

        expect(signal).toBe(abortController.signal)
      })
    })

    describe('错误处理', () => {
      it('setGenerationError应该设置错误状态', () => {
        const store = useChatStore.getState()
        store.startGeneration(projectId)

        store.setGenerationError(projectId, '网络错误')

        const task = store.getTask(projectId)
        expect(task.error).toBe('网络错误')
        expect(task.generationPhase).toBe('error')
      })
    })
  })

  describe('usePRDGenerationStore', () => {
    const projectId = 'test-project-id'

    describe('流式内容优化', () => {
      it('appendTaskContent应该使用chunks数组追加内容', () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)

        store.appendTaskContent(projectId, '第一段内容')
        store.appendTaskContent(projectId, '第二段内容')
        store.appendTaskContent(projectId, '第三段内容')

        const content = store.getTaskContent(projectId)
        expect(content).toBe('第一段内容第二段内容第三段内容')

        const task = store.getTask(projectId)
        expect(task?.streamContent).toBe(content)
      })

      it('getTaskContent应该合并chunks为完整字符串', () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)

        // 模拟流式追加大量内容
        for (let i = 0; i < 100; i++) {
          store.appendTaskContent(projectId, `段落${i}\n`)
        }

        const content = store.getTaskContent(projectId)
        expect(content).toContain('段落0')
        expect(content).toContain('段落99')
        expect(content.split('\n').length).toBe(101) // 100段 + 最后一个空行
      })

      it('updateTaskContent应该重置chunks', () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)

        store.appendTaskContent(projectId, '旧内容1')
        store.appendTaskContent(projectId, '旧内容2')

        store.updateTaskContent(projectId, '新内容')

        const content = store.getTaskContent(projectId)
        expect(content).toBe('新内容')
      })
    })

    describe('任务生命周期', () => {
      it('startTask应该创建任务并持久化', async () => {
        const store = usePRDGenerationStore.getState()

        const abortController = store.startTask(projectId)

        expect(abortController).toBeInstanceOf(AbortController)
        
        const task = store.getTask(projectId)
        expect(task?.phase).toBe('generating')
        expect(task?.projectId).toBe(projectId)

        // 等待异步持久化完成
        await new Promise(resolve => setTimeout(resolve, 50))

        const persisted = await prdTasksDB.get(projectId)
        expect(persisted?.phase).toBe('generating')
      })

      it('completeTask应该更新状态并持久化', async () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)
        store.appendTaskContent(projectId, 'PRD内容')

        await store.completeTask(projectId)

        const task = store.getTask(projectId)
        expect(task?.phase).toBe('completed')
        expect(task?.abortController).toBeUndefined()

        const persisted = await prdTasksDB.get(projectId)
        expect(persisted?.phase).toBe('completed')
      })

      it('errorTask应该设置错误状态并持久化', async () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)

        await store.errorTask(projectId, '生成失败')

        const task = store.getTask(projectId)
        expect(task?.phase).toBe('error')
        expect(task?.error).toBe('生成失败')

        const persisted = await prdTasksDB.get(projectId)
        expect(persisted?.phase).toBe('error')
        expect(persisted?.error).toBe('生成失败')
      })

      it('cancelTask应该调用abort并清理状态', async () => {
        const store = usePRDGenerationStore.getState()
        const abortController = store.startTask(projectId)
        const abortSpy = jest.spyOn(abortController, 'abort')

        await store.cancelTask(projectId)

        expect(abortSpy).toHaveBeenCalled()
        expect(store.getTask(projectId)).toBeUndefined()
      })

      it('clearTask应该删除任务', async () => {
        const store = usePRDGenerationStore.getState()
        store.startTask(projectId)

        await store.clearTask(projectId)

        expect(store.getTask(projectId)).toBeUndefined()
      })
    })

    describe('任务恢复机制', () => {
      it('loadPersistedTask应该从数据库加载任务', async () => {
        const store = usePRDGenerationStore.getState()
        
        // 创建并持久化任务
        await prdTasksDB.save({
          projectId,
          phase: 'generating',
          startTime: Date.now(),
          elapsedTime: 1000,
          streamContent: '已生成的内容',
        })

        const persisted = await store.loadPersistedTask(projectId)

        expect(persisted?.projectId).toBe(projectId)
        expect(persisted?.phase).toBe('generating')
        expect(persisted?.streamContent).toBe('已生成的内容')
      })

      it('updateElapsedTime应该更新已用时间', () => {
        const store = usePRDGenerationStore.getState()
        const startTime = Date.now()
        
        // 手动设置任务以确保 phase 为 'generating'
        usePRDGenerationStore.setState({
          tasks: {
            [projectId]: {
              projectId,
              phase: 'generating',
              startTime: startTime - 5000, // 5秒前开始
              elapsedTime: 0,
              streamContent: '',
              abortController: new AbortController(),
            },
          },
        })

        store.updateElapsedTime(projectId)

        const updatedTask = store.getTask(projectId)
        // 已经过了5秒，elapsedTime应该是5
        expect(updatedTask?.elapsedTime).toBe(5)
      })
    })
  })
})
