import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { projectsDB, settingsDB } from '@/lib/db';
import type { Project, Settings, ConversationMessage, UserChoice } from '@/types';

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
  isStreaming: boolean;
  streamContent: string;
  error: string | null;
  
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  clearStreamContent: () => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  isStreaming: false,
  streamContent: '',
  error: null,

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
  }
}));
