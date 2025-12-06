import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { projectsDB, settingsDB, chatDraftsDB, prdTasksDB } from '@/lib/db';
import type { 
  Project, 
  Settings, 
  ConversationMessage, 
  UserChoice,
  GenerationPhase,
  GenerationStep,
  SelectorData,
  QuestionMeta,
  GENERATION_STEPS,
  PRDGenerationPhase,
  PRDGenerationTask,
  ChatDraft,
  PRDGenerationTaskPersisted
} from '@/types';

// 项目Store状态
interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
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
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  searchKeyword: '',

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
        set({ currentProject: project, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ isLoading: false });
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    await projectsDB.update(id, updates);
    const { currentProject, projects } = get();
    
    if (currentProject?.id === id) {
      set({ currentProject: { ...currentProject, ...updates, updatedAt: Date.now() } });
    }
    
    set({
      projects: projects.map(p => 
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      )
    });
  },

  deleteProject: async (id: string) => {
    await projectsDB.delete(id);
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject
    }));
  },

  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });
  },

  addMessage: async (message: ConversationMessage) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    
    const newConversation = [...currentProject.conversation, message];
    const userMessages = newConversation.filter(m => m.role === 'user');
    const now = Date.now();
    
    const updatedProject: Project = {
      ...currentProject,
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
      metadata: updatedProject.metadata
    });
    
    // 同时更新 currentProject 和 projects 列表
    set({
      currentProject: updatedProject,
      projects: projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      )
    });
  },

  updatePRDContent: async (content: string) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    
    const now = Date.now();
    const updatedProject: Project = {
      ...currentProject,
      prdContent: content,
      updatedAt: now
    };
    
    await projectsDB.update(currentProject.id, { prdContent: content });
    
    // 同时更新 currentProject 和 projects 列表
    set({
      currentProject: updatedProject,
      projects: projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      )
    });
  },

  setProjectStatus: async (status: Project['status']) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;
    
    const now = Date.now();
    const updatedProject: Project = {
      ...currentProject,
      status,
      updatedAt: now
    };
    
    await projectsDB.update(currentProject.id, { status });
    
    // 同时更新 currentProject 和 projects 列表
    set({
      currentProject: updatedProject,
      projects: projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      )
    });
  },

  clearCurrentProject: () => {
    set({ currentProject: null });
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

// 聊天Store状态
interface ChatStore {
  // 原有状态
  isStreaming: boolean;
  streamContent: string;
  error: string | null;
  
  // 新增生成状态
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
  
  // 原有方法
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  clearStreamContent: () => void;
  setError: (error: string | null) => void;
  
  // 新增方法
  startGeneration: (retryParams?: { content: string }) => void;
  setGenerationPhase: (phase: GenerationPhase) => void;
  advanceStep: () => void;
  setStepByIndex: (index: number) => void;
  setPendingSelectors: (selectors: SelectorData[], meta?: QuestionMeta) => void;
  completeGeneration: () => void;
  cancelGeneration: () => void;
  setGenerationError: (error: string) => void;
  updateElapsedTime: () => void;
  resetGeneration: () => void;
  // 新增：安全中断并重置（用于组件卸载时）
  abortAndReset: () => void;
  // 新增：获取当前 AbortController的signal（用于fetch请求）
  getAbortSignal: () => AbortSignal | undefined;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // 原有状态
  isStreaming: false,
  streamContent: '',
  error: null,
  
  // 新增状态初始化
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

  // 原有方法
  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  appendStreamContent: (content: string) => {
    set(state => ({ streamContent: state.streamContent + content }));
  },

  clearStreamContent: () => {
    set({ streamContent: '' });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // 新增方法
  startGeneration: (retryParams) => {
    const abortController = new AbortController();
    set({
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
    });
  },

  setGenerationPhase: (phase: GenerationPhase) => {
    set({ generationPhase: phase });
  },

  advanceStep: () => {
    const { stepIndex } = get();
    const steps: GenerationStep[] = ['understanding', 'generating', 'building', 'validating'];
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    set({
      stepIndex: nextIndex,
      currentStep: steps[nextIndex],
    });
  },

  setStepByIndex: (index: number) => {
    const steps: GenerationStep[] = ['understanding', 'generating', 'building', 'validating'];
    const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
    set({
      stepIndex: safeIndex,
      currentStep: steps[safeIndex],
    });
  },

  setPendingSelectors: (selectors: SelectorData[], meta?: QuestionMeta) => {
    set({ 
      pendingSelectors: selectors,
      questionMeta: meta || null,
    });
  },

  completeGeneration: () => {
    set({
      generationPhase: 'interactive',
      canCancel: false,
      isStreaming: false,
      abortController: null,
    });
  },

  cancelGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      generationPhase: 'idle',
      isStreaming: false,
      streamContent: '',
      pendingSelectors: [],
      abortController: null,
      canCancel: false,
    });
  },

  setGenerationError: (error: string) => {
    set({
      generationPhase: 'error',
      error,
      isStreaming: false,
      canCancel: false,
    });
  },

  updateElapsedTime: () => {
    const { startTime, generationPhase } = get();
    if (generationPhase === 'generating' && startTime > 0) {
      set({ elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
    }
  },

  resetGeneration: () => {
    // 重置前先中断进行中的请求
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      generationPhase: 'idle',
      currentStep: 'understanding',
      stepIndex: 0,
      startTime: 0,
      elapsedTime: 0,
      pendingSelectors: [],
      questionMeta: null,
      error: null,
      canCancel: true,
      abortController: null,
      retryParams: null,
      isStreaming: false,
      streamContent: '',
    });
  },

  // 安全中断并重置（用于组件卸载时）
  abortAndReset: () => {
    const { abortController, generationPhase } = get();
    // 如果有进行中的请求，先中断
    if (abortController && generationPhase === 'generating') {
      abortController.abort();
    }
    // 重置状态
    set({
      generationPhase: 'idle',
      currentStep: 'understanding',
      stepIndex: 0,
      startTime: 0,
      elapsedTime: 0,
      pendingSelectors: [],
      questionMeta: null,
      error: null,
      canCancel: true,
      abortController: null,
      retryParams: null,
      isStreaming: false,
      streamContent: '',
    });
  },

  // 获取当前 AbortController的signal
  getAbortSignal: () => {
    return get().abortController?.signal;
  },
}));

// ========== PRD生成Store状态 ==========
interface PRDGenerationStore {
  // 生成任务映射: projectId -> 任务状态
  tasks: Record<string, PRDGenerationTask>;
  
  // 方法
  getTask: (projectId: string) => PRDGenerationTask | undefined;
  startTask: (projectId: string) => AbortController;
  updateTaskContent: (projectId: string, content: string) => void;
  appendTaskContent: (projectId: string, content: string) => void;
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
      };
    });
  },

  appendTaskContent: (projectId: string, content: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: { ...task, streamContent: task.streamContent + content },
        },
      };
    });
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
      delete newTasks[projectId];
      return { tasks: newTasks };
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
      delete newTasks[projectId];
      return { tasks: newTasks };
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
