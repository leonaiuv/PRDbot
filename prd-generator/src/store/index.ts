import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { projectsDB, settingsDB, prdTasksDB } from '@/lib/db';
import type { 
  Project, 
  Settings, 
  ConversationMessage, 
  GenerationPhase,
  GenerationStep,
  SelectorData,
  QuestionMeta,
  PRDGenerationTask,
  PRDGenerationTaskPersisted
} from '@/types';

// 项目Store状态
interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;  // P2: 改为存储 ID，从 projects 派生 currentProject
  isLoading: boolean;
  searchKeyword: string;
  
  // 操作方法
  loadProjects: () => Promise<void>;
  createProject: (name: string, initialInput: string) => Promise<Project>;
  loadProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setSearchKeyword: (keyword: string) => void;
  addMessage: (message: ConversationMessage) => Promise<void>;
  updatePRDContent: (content: string) => Promise<void>;
  setProjectStatus: (status: Project['status']) => Promise<void>;
  clearCurrentProject: () => void;
  // P2: 添加派生状态 getter
  getCurrentProject: () => Project | null;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,
  searchKeyword: '',

  // P2: 从 projects 派生 currentProject
  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    if (!currentProjectId) return null;
    return projects.find(p => p.id === currentProjectId) || null;
  },

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await projectsDB.getAll();
      set({ projects, isLoading: false });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ isLoading: false });
    }
  },

  createProject: async (name: string, initialInput: string) => {
    const now = Date.now();
    const project: Project = {
      id: uuidv4(),
      name: name || '未命名项目',
      createdAt: now,
      updatedAt: now,
      status: 'exploring',
      initialInput,
      conversation: [],
      prdContent: '',
      metadata: {
        questionCount: 0,
        progress: 0,
        selectedModel: 'deepseek'
      }
    };
    
    await projectsDB.create(project);
    set(state => ({ projects: [project, ...state.projects] }));
    return project;
  },

  loadProject: async (id: string) => {
    set({ isLoading: true });
    try {
      const project = await projectsDB.getById(id);
      if (project) {
        // P2: 确保项目在 projects 列表中，然后设置 currentProjectId
        const { projects } = get();
        const existsInList = projects.some(p => p.id === id);
        if (existsInList) {
          // 更新列表中的项目（确保数据最新）
          set({
            projects: projects.map(p => p.id === id ? project : p),
            currentProjectId: id,
            isLoading: false
          });
        } else {
          // 项目不在列表中，添加到列表
          set({
            projects: [project, ...projects],
            currentProjectId: id,
            isLoading: false
          });
        }
      } else {
        set({ currentProjectId: null, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ isLoading: false });
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    await projectsDB.update(id, updates);
    const { projects } = get();
    
    // P2: 只更新 projects 列表，currentProject 自动派生
    set({
      projects: projects.map(p => 
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      )
    });
  },

  deleteProject: async (id: string) => {
    await projectsDB.delete(id);
    const { currentProjectId } = get();
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProjectId: currentProjectId === id ? null : currentProjectId
    }));
  },

  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });
  },

  addMessage: async (message: ConversationMessage) => {
    const currentProject = get().getCurrentProject();
    if (!currentProject) return;
    
    const newConversation = [...currentProject.conversation, message];
    const userMessages = newConversation.filter(m => m.role === 'user');
    const now = Date.now();
    
    const updates = {
      conversation: newConversation,
      updatedAt: now,
      metadata: {
        ...currentProject.metadata,
        questionCount: userMessages.length,
        progress: Math.min((userMessages.length / 20) * 100, 100)
      }
    };
    
    await projectsDB.update(currentProject.id, {
      conversation: newConversation,
      metadata: updates.metadata
    });
    
    // P2: 只更新 projects 列表
    set(state => ({
      projects: state.projects.map(p => 
        p.id === currentProject.id ? { ...p, ...updates } : p
      )
    }));
  },

  updatePRDContent: async (content: string) => {
    const currentProject = get().getCurrentProject();
    if (!currentProject) return;
    
    const now = Date.now();
    
    await projectsDB.update(currentProject.id, { prdContent: content });
    
    // P2: 只更新 projects 列表
    set(state => ({
      projects: state.projects.map(p => 
        p.id === currentProject.id ? { ...p, prdContent: content, updatedAt: now } : p
      )
    }));
  },

  setProjectStatus: async (status: Project['status']) => {
    const currentProject = get().getCurrentProject();
    if (!currentProject) return;
    
    const now = Date.now();
    
    await projectsDB.update(currentProject.id, { status });
    
    // P2: 只更新 projects 列表
    set(state => ({
      projects: state.projects.map(p => 
        p.id === currentProject.id ? { ...p, status, updatedAt: now } : p
      )
    }));
  },

  clearCurrentProject: () => {
    set({ currentProjectId: null });
  }
}));

// 设置Store状态
interface SettingsStore {
  settings: Settings | null;
  isLoading: boolean;
  
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  getApiKey: (provider: string) => string | undefined;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await settingsDB.getOrCreate();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<Settings>) => {
    const { settings } = get();
    if (!settings) return;
    
    await settingsDB.update(updates);
    set({ settings: { ...settings, ...updates } });
  },

  setApiKey: async (provider: string, key: string) => {
    const { settings } = get();
    if (!settings) return;
    
    const newApiKeys = { ...settings.apiKeys, [provider]: key };
    await settingsDB.update({ apiKeys: newApiKeys });
    set({ settings: { ...settings, apiKeys: newApiKeys } });
  },

  getApiKey: (provider: string) => {
    const { settings } = get();
    return settings?.apiKeys[provider];
  }
}));

// ========== 聊天生成任务类型 ==========
interface ChatGenerationTask {
  projectId: string;
  isStreaming: boolean;
  streamContent: string;
  error: string | null;
  generationPhase: GenerationPhase;
  currentStep: GenerationStep;
  stepIndex: number;
  startTime: number;
  elapsedTime: number;
  pendingSelectors: SelectorData[];
  questionMeta: QuestionMeta | null;
  canCancel: boolean;
  abortController: AbortController | null;
  retryParams: { content: string } | null;
}

// 创建默认任务状态
const createDefaultChatTask = (projectId: string): ChatGenerationTask => ({
  projectId,
  isStreaming: false,
  streamContent: '',
  error: null,
  generationPhase: 'idle',
  currentStep: 'understanding',
  stepIndex: 0,
  startTime: 0,
  elapsedTime: 0,
  pendingSelectors: [],
  questionMeta: null,
  canCancel: true,
  abortController: null,
  retryParams: null,
});

// 聊天Store状态 - 按 projectId 隔离
interface ChatStore {
  // 生成任务映射: projectId -> 任务状态
  tasks: Record<string, ChatGenerationTask>;
  
  // 获取任务（如果不存在则返回默认状态）
  getTask: (projectId: string) => ChatGenerationTask;
  
  // 方法（所有方法都需要传入 projectId）
  startGeneration: (projectId: string, retryParams?: { content: string }) => AbortController;
  setGenerationPhase: (projectId: string, phase: GenerationPhase) => void;
  advanceStep: (projectId: string) => void;
  setStepByIndex: (projectId: string, index: number) => void;
  setPendingSelectors: (projectId: string, selectors: SelectorData[], meta?: QuestionMeta) => void;
  completeGeneration: (projectId: string) => void;
  cancelGeneration: (projectId: string) => void;
  setGenerationError: (projectId: string, error: string) => void;
  updateElapsedTime: (projectId: string) => void;
  resetGeneration: (projectId: string) => void;
  abortAndReset: (projectId: string) => void;
  getAbortSignal: (projectId: string) => AbortSignal | undefined;
  clearTask: (projectId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  tasks: {},

  getTask: (projectId: string) => {
    return get().tasks[projectId] || createDefaultChatTask(projectId);
  },

  startGeneration: (projectId: string, retryParams) => {
    const abortController = new AbortController();
    const task: ChatGenerationTask = {
      projectId,
      generationPhase: 'generating',
      currentStep: 'understanding',
      stepIndex: 0,
      startTime: Date.now(),
      elapsedTime: 0,
      pendingSelectors: [],
      questionMeta: null,
      error: null,
      canCancel: true,
      abortController,
      retryParams: retryParams || null,
      isStreaming: true,
      streamContent: '',
    };
    set(state => ({
      tasks: { ...state.tasks, [projectId]: task },
    }));
    return abortController;
  },

  setGenerationPhase: (projectId: string, phase: GenerationPhase) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: { ...state.tasks, [projectId]: { ...task, generationPhase: phase } },
      };
    });
  },

  advanceStep: (projectId: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      const steps: GenerationStep[] = ['understanding', 'generating', 'building', 'validating'];
      const nextIndex = Math.min(task.stepIndex + 1, steps.length - 1);
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            stepIndex: nextIndex,
            currentStep: steps[nextIndex],
          },
        },
      };
    });
  },

  setStepByIndex: (projectId: string, index: number) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      const steps: GenerationStep[] = ['understanding', 'generating', 'building', 'validating'];
      const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            stepIndex: safeIndex,
            currentStep: steps[safeIndex],
          },
        },
      };
    });
  },

  setPendingSelectors: (projectId: string, selectors: SelectorData[], meta?: QuestionMeta) => {
    set(state => {
      const task = state.tasks[projectId] || createDefaultChatTask(projectId);
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            pendingSelectors: selectors,
            questionMeta: meta || null,
          },
        },
      };
    });
  },

  completeGeneration: (projectId: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            generationPhase: 'interactive',
            canCancel: false,
            isStreaming: false,
            abortController: null,
          },
        },
      };
    });
  },

  cancelGeneration: (projectId: string) => {
    const task = get().tasks[projectId];
    if (task?.abortController) {
      task.abortController.abort();
    }
    set(state => {
      const currentTask = state.tasks[projectId];
      if (!currentTask) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...currentTask,
            generationPhase: 'idle',
            isStreaming: false,
            streamContent: '',
            pendingSelectors: [],
            abortController: null,
            canCancel: false,
          },
        },
      };
    });
  },

  setGenerationError: (projectId: string, error: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            generationPhase: 'error',
            error,
            isStreaming: false,
            canCancel: false,
          },
        },
      };
    });
  },

  updateElapsedTime: (projectId: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task || task.generationPhase !== 'generating' || task.startTime <= 0) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            elapsedTime: Math.floor((Date.now() - task.startTime) / 1000),
          },
        },
      };
    });
  },

  resetGeneration: (projectId: string) => {
    const task = get().tasks[projectId];
    if (task?.abortController) {
      task.abortController.abort();
    }
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: createDefaultChatTask(projectId),
      },
    }));
  },

  abortAndReset: (projectId: string) => {
    const task = get().tasks[projectId];
    if (task?.abortController && task.generationPhase === 'generating') {
      task.abortController.abort();
    }
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: createDefaultChatTask(projectId),
      },
    }));
  },

  getAbortSignal: (projectId: string) => {
    return get().tasks[projectId]?.abortController?.signal;
  },

  clearTask: (projectId: string) => {
    set(state => {
      const newTasks = { ...state.tasks };
      delete newTasks[projectId];
      return { tasks: newTasks };
    });
  },
}));

// ========== PRD生成Store状态 ==========
interface PRDGenerationStore {
  // 生成任务映射: projectId -> 任务状态
  tasks: Record<string, PRDGenerationTask>;
  // P2: 流式内容缓冲 - 使用数组存储 chunks，减少字符串拼接开销
  contentChunks: Record<string, string[]>;
  
  // 方法
  getTask: (projectId: string) => PRDGenerationTask | undefined;
  startTask: (projectId: string) => AbortController;
  updateTaskContent: (projectId: string, content: string) => void;
  appendTaskContent: (projectId: string, content: string) => void;
  // P2: 获取合并后的内容
  getTaskContent: (projectId: string) => string;
  completeTask: (projectId: string) => Promise<void>;
  errorTask: (projectId: string, error: string) => Promise<void>;
  cancelTask: (projectId: string) => Promise<void>;
  updateElapsedTime: (projectId: string) => void;
  clearTask: (projectId: string) => Promise<void>;
  // 新增：从持久化存储加载任务
  loadPersistedTask: (projectId: string) => Promise<PRDGenerationTaskPersisted | undefined>;
  // 新增：恢复中断的任务（从持久化恢复到内存）
  restoreTask: (projectId: string) => Promise<boolean>;
  // 新增：持久化当前任务状态
  persistTask: (projectId: string) => Promise<void>;
  // 新增：安全中断并保存（用于组件卸载时）
  abortAndPersist: (projectId: string) => Promise<void>;
}

export const usePRDGenerationStore = create<PRDGenerationStore>((set, get) => ({
  tasks: {},
  contentChunks: {},

  getTask: (projectId: string) => {
    return get().tasks[projectId];
  },

  startTask: (projectId: string) => {
    const abortController = new AbortController();
    const task: PRDGenerationTask = {
      projectId,
      phase: 'generating',
      startTime: Date.now(),
      elapsedTime: 0,
      streamContent: '',
      abortController,
    };
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: task,
      },
      // P2: 初始化 chunks 数组
      contentChunks: {
        ...state.contentChunks,
        [projectId]: [],
      },
    }));
    // 异步持久化（不阻塞）
    prdTasksDB.save({
      projectId,
      phase: 'generating',
      startTime: task.startTime,
      elapsedTime: 0,
      streamContent: '',
    }).catch(console.error);
    return abortController;
  },

  updateTaskContent: (projectId: string, content: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: { ...task, streamContent: content },
        },
        // P2: 更新时重置 chunks
        contentChunks: {
          ...state.contentChunks,
          [projectId]: [content],
        },
      };
    });
  },

  // P2: 使用数组存储 chunks，减少字符串拼接开销
  appendTaskContent: (projectId: string, content: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      const currentChunks = state.contentChunks[projectId] || [];
      const newChunks = [...currentChunks, content];
      return {
        tasks: {
          ...state.tasks,
          [projectId]: { ...task, streamContent: newChunks.join('') },
        },
        contentChunks: {
          ...state.contentChunks,
          [projectId]: newChunks,
        },
      };
    });
  },

  // P2: 获取合并后的内容
  getTaskContent: (projectId: string) => {
    const chunks = get().contentChunks[projectId];
    return chunks ? chunks.join('') : '';
  },

  completeTask: async (projectId: string) => {
    const task = get().tasks[projectId];
    if (!task) return;
    
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: { 
          ...task, 
          phase: 'completed',
          abortController: undefined,
        },
      },
    }));
    
    // 持久化完成状态
    await prdTasksDB.save({
      projectId,
      phase: 'completed',
      startTime: task.startTime,
      elapsedTime: task.elapsedTime,
      streamContent: task.streamContent,
    });
  },

  errorTask: async (projectId: string, error: string) => {
    const task = get().tasks[projectId];
    if (!task) return;
    
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: { 
          ...task, 
          phase: 'error',
          error,
          abortController: undefined,
        },
      },
    }));
    
    // 持久化错误状态
    await prdTasksDB.save({
      projectId,
      phase: 'error',
      startTime: task.startTime,
      elapsedTime: task.elapsedTime,
      streamContent: task.streamContent,
      error,
    });
  },

  cancelTask: async (projectId: string) => {
    const task = get().tasks[projectId];
    if (task?.abortController) {
      task.abortController.abort();
    }
    set(state => {
      const newTasks = { ...state.tasks };
      const newChunks = { ...state.contentChunks };
      delete newTasks[projectId];
      delete newChunks[projectId];
      return { tasks: newTasks, contentChunks: newChunks };
    });
    // 删除持久化记录
    await prdTasksDB.delete(projectId);
  },

  updateElapsedTime: (projectId: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task || task.phase !== 'generating') return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: {
            ...task,
            elapsedTime: Math.floor((Date.now() - task.startTime) / 1000),
          },
        },
      };
    });
  },

  clearTask: async (projectId: string) => {
    set(state => {
      const newTasks = { ...state.tasks };
      const newChunks = { ...state.contentChunks };
      delete newTasks[projectId];
      delete newChunks[projectId];
      return { tasks: newTasks, contentChunks: newChunks };
    });
    // 删除持久化记录
    await prdTasksDB.delete(projectId);
  },

  // 从持久化存储加载任务
  loadPersistedTask: async (projectId: string) => {
    return await prdTasksDB.get(projectId);
  },

  // 恢复中断的任务（从持久化恢复到内存）
  restoreTask: async (projectId: string) => {
    const persisted = await prdTasksDB.get(projectId);
    if (!persisted) return false;
    
    // 如果是生成中状态，标记为错误（因为请求已中断）
    if (persisted.phase === 'generating') {
      const task: PRDGenerationTask = {
        projectId: persisted.projectId,
        phase: 'error',
        startTime: persisted.startTime,
        elapsedTime: persisted.elapsedTime,
        streamContent: persisted.streamContent,
        error: '生成过程中断，请重试',
      };
      set(state => ({
        tasks: {
          ...state.tasks,
          [projectId]: task,
        },
      }));
      // 更新持久化状态
      await prdTasksDB.save({
        ...persisted,
        phase: 'error',
        error: '生成过程中断，请重试',
      });
      return true;
    }
    
    // 其他状态直接恢复
    if (persisted.phase === 'error') {
      set(state => ({
        tasks: {
          ...state.tasks,
          [projectId]: {
            projectId: persisted.projectId,
            phase: persisted.phase,
            startTime: persisted.startTime,
            elapsedTime: persisted.elapsedTime,
            streamContent: persisted.streamContent,
            error: persisted.error,
          },
        },
      }));
      return true;
    }
    
    return false;
  },

  // 持久化当前任务状态
  persistTask: async (projectId: string) => {
    const task = get().tasks[projectId];
    if (!task) return;
    
    await prdTasksDB.save({
      projectId: task.projectId,
      phase: task.phase,
      startTime: task.startTime,
      elapsedTime: task.elapsedTime,
      streamContent: task.streamContent,
      error: task.error,
    });
  },

  // 安全中断并保存（用于组件卸载时）
  abortAndPersist: async (projectId: string) => {
    const task = get().tasks[projectId];
    if (!task) return;
    
    // 如果正在生成，中断请求
    if (task.abortController && task.phase === 'generating') {
      task.abortController.abort();
    }
    
    // 保存当前进度（标记为中断错误）
    await prdTasksDB.save({
      projectId: task.projectId,
      phase: 'error',
      startTime: task.startTime,
      elapsedTime: task.elapsedTime,
      streamContent: task.streamContent,
      error: '生成过程中断，请重试',
    });
    
    // 更新内存状态
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: {
          ...task,
          phase: 'error',
          error: '生成过程中断，请重试',
          abortController: undefined,
        },
      },
    }));
  },
}));
