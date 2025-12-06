import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { projectsDB, settingsDB } from '@/lib/db';
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
  PRDGenerationTask
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
    const { currentProject } = get();
    if (!currentProject) return;
    
    const newConversation = [...currentProject.conversation, message];
    const userMessages = newConversation.filter(m => m.role === 'user');
    
    await projectsDB.update(currentProject.id, {
      conversation: newConversation,
      metadata: {
        ...currentProject.metadata,
        questionCount: userMessages.length,
        progress: Math.min((userMessages.length / 20) * 100, 100)
      }
    });
    
    set({
      currentProject: {
        ...currentProject,
        conversation: newConversation,
        updatedAt: Date.now(),
        metadata: {
          ...currentProject.metadata,
          questionCount: userMessages.length,
          progress: Math.min((userMessages.length / 20) * 100, 100)
        }
      }
    });
  },

  updatePRDContent: async (content: string) => {
    const { currentProject } = get();
    if (!currentProject) return;
    
    await projectsDB.update(currentProject.id, { prdContent: content });
    set({
      currentProject: {
        ...currentProject,
        prdContent: content,
        updatedAt: Date.now()
      }
    });
  },

  setProjectStatus: async (status: Project['status']) => {
    const { currentProject } = get();
    if (!currentProject) return;
    
    await projectsDB.update(currentProject.id, { status });
    set({
      currentProject: {
        ...currentProject,
        status,
        updatedAt: Date.now()
      }
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
  completeTask: (projectId: string) => void;
  errorTask: (projectId: string, error: string) => void;
  cancelTask: (projectId: string) => void;
  updateElapsedTime: (projectId: string) => void;
  clearTask: (projectId: string) => void;
}

export const usePRDGenerationStore = create<PRDGenerationStore>((set, get) => ({
  tasks: {},

  getTask: (projectId: string) => {
    return get().tasks[projectId];
  },

  startTask: (projectId: string) => {
    const abortController = new AbortController();
    set(state => ({
      tasks: {
        ...state.tasks,
        [projectId]: {
          projectId,
          phase: 'generating',
          startTime: Date.now(),
          elapsedTime: 0,
          streamContent: '',
          abortController,
        },
      },
    }));
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

  completeTask: (projectId: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: { 
            ...task, 
            phase: 'completed',
            abortController: undefined,
          },
        },
      };
    });
  },

  errorTask: (projectId: string, error: string) => {
    set(state => {
      const task = state.tasks[projectId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [projectId]: { 
            ...task, 
            phase: 'error',
            error,
            abortController: undefined,
          },
        },
      };
    });
  },

  cancelTask: (projectId: string) => {
    const task = get().tasks[projectId];
    if (task?.abortController) {
      task.abortController.abort();
    }
    set(state => {
      const newTasks = { ...state.tasks };
      delete newTasks[projectId];
      return { tasks: newTasks };
    });
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

  clearTask: (projectId: string) => {
    set(state => {
      const newTasks = { ...state.tasks };
      delete newTasks[projectId];
      return { tasks: newTasks };
    });
  },
}));
