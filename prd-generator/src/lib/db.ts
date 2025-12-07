import Dexie, { type EntityTable } from 'dexie';
import type { Project, Settings, ChatDraft, PRDGenerationTaskPersisted, PRDVersion, TranslationTaskPersisted, TranslationCache } from '@/types';
import { encryptApiKeys, decryptApiKeys, isEncrypted } from './crypto';

// 定义数据库类
class PRDDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  chatDrafts!: EntityTable<ChatDraft, 'projectId'>;
  prdTasks!: EntityTable<PRDGenerationTaskPersisted, 'projectId'>;
  prdVersions!: EntityTable<PRDVersion, 'id'>;
  translationTasks!: EntityTable<TranslationTaskPersisted, 'id'>;
  translationCache!: EntityTable<TranslationCache, 'id'>;

  constructor() {
    super('PRDGeneratorDB');
    
    // 版本1: 初始结构
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt, status',
      settings: 'id'
    });
    
    // 版本2: 添加聊天草稿和PRD任务持久化
    this.version(2).stores({
      projects: 'id, name, createdAt, updatedAt, status',
      settings: 'id',
      chatDrafts: 'projectId, updatedAt',
      prdTasks: 'projectId, phase, updatedAt'
    });

    // 版本3: 添加PRD版本历史
    this.version(3).stores({
      projects: 'id, name, createdAt, updatedAt, status',
      settings: 'id',
      chatDrafts: 'projectId, updatedAt',
      prdTasks: 'projectId, phase, updatedAt',
      prdVersions: 'id, projectId, createdAt'
    });

    // 版本4: 添加翻译任务和翻译缓存
    this.version(4).stores({
      projects: 'id, name, createdAt, updatedAt, status',
      settings: 'id',
      chatDrafts: 'projectId, updatedAt',
      prdTasks: 'projectId, phase, updatedAt',
      prdVersions: 'id, projectId, createdAt',
      translationTasks: 'id, projectId, langCode, phase, updatedAt',
      translationCache: 'id, projectId, langCode, contentHash, updatedAt'
    });
  }
}

// 创建数据库实例
export const db = new PRDDatabase();

// 项目操作函数
export const projectsDB = {
  // 获取所有项目
  async getAll(): Promise<Project[]> {
    return await db.projects.orderBy('updatedAt').reverse().toArray();
  },

  // 根据ID获取项目
  async getById(id: string): Promise<Project | undefined> {
    return await db.projects.get(id);
  },

  // 创建项目
  async create(project: Project): Promise<string> {
    return await db.projects.add(project);
  },

  // 更新项目
  async update(id: string, updates: Partial<Project>): Promise<number> {
    return await db.projects.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  },

  // 删除项目
  async delete(id: string): Promise<void> {
    return await db.projects.delete(id);
  },

  // 搜索项目
  async search(keyword: string): Promise<Project[]> {
    const allProjects = await db.projects.toArray();
    return allProjects.filter(p => 
      p.name.toLowerCase().includes(keyword.toLowerCase()) ||
      p.initialInput.toLowerCase().includes(keyword.toLowerCase())
    );
  }
};

// 设置操作函数
export const settingsDB = {
  // 获取设置（解密 API Keys）
  async get(): Promise<Settings | undefined> {
    const settings = await db.settings.get('global');
    if (settings && settings.apiKeys) {
      // 检查每个 API Key 是否已加密，并分别处理
      const hasAnyEncrypted = Object.values(settings.apiKeys).some(
        key => key && isEncrypted(key)
      );
      
      if (hasAnyEncrypted) {
        // 解密所有 API Keys
        settings.apiKeys = decryptApiKeys(settings.apiKeys);
      }
    }
    return settings;
  },

  // 保存设置（加密 API Keys）
  async save(settings: Omit<Settings, 'id'>): Promise<string> {
    const encryptedSettings: Settings = {
      id: 'global',
      ...settings,
      apiKeys: settings.apiKeys ? encryptApiKeys(settings.apiKeys) : {}
    };
    await db.settings.put(encryptedSettings);
    return 'global';
  },

  // 更新设置（如果包含 apiKeys 则加密）
  async update(updates: Partial<Settings>): Promise<void> {
    const current = await db.settings.get('global'); // 获取原始数据（可能已加密）
    
    // 如果更新包含 apiKeys，需要加密
    const encryptedUpdates = { ...updates };
    if (updates.apiKeys) {
      encryptedUpdates.apiKeys = encryptApiKeys(updates.apiKeys);
    }
    
    if (current) {
      await db.settings.update('global', encryptedUpdates);
    } else {
      await this.save({
        apiKeys: {},
        defaultModel: 'deepseek',
        exportPreferences: { defaultFormat: 'md' },
        ...updates
      });
    }
  },

  // 获取或创建默认设置（解密 API Keys）
  async getOrCreate(): Promise<Settings> {
    let settings = await this.get(); // 使用 get() 以确保解密
    if (!settings) {
      const defaultSettings: Settings = {
        id: 'global',
        apiKeys: {},
        defaultModel: 'deepseek',
        exportPreferences: { defaultFormat: 'md' }
      };
      await db.settings.put(defaultSettings);
      settings = defaultSettings;
    }
    return settings;
  }
};

// 聊天草稿操作函数
export const chatDraftsDB = {
  // 获取指定项目的草稿
  async get(projectId: string): Promise<ChatDraft | undefined> {
    return await db.chatDrafts.get(projectId);
  },

  // 保存或更新草稿
  async save(draft: Omit<ChatDraft, 'updatedAt'>): Promise<string> {
    const draftWithTime: ChatDraft = {
      ...draft,
      updatedAt: Date.now()
    };
    await db.chatDrafts.put(draftWithTime);
    return draft.projectId;
  },

  // 删除草稿
  async delete(projectId: string): Promise<void> {
    return await db.chatDrafts.delete(projectId);
  },

  // 清理过期草稿（7天前）
  async cleanupOld(): Promise<number> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return await db.chatDrafts.where('updatedAt').below(cutoff).delete();
  }
};

// PRD任务持久化操作函数
export const prdTasksDB = {
  // 获取指定项目的任务
  async get(projectId: string): Promise<PRDGenerationTaskPersisted | undefined> {
    return await db.prdTasks.get(projectId);
  },

  // 保存或更新任务
  async save(task: Omit<PRDGenerationTaskPersisted, 'updatedAt'>): Promise<string> {
    const taskWithTime: PRDGenerationTaskPersisted = {
      ...task,
      updatedAt: Date.now()
    };
    await db.prdTasks.put(taskWithTime);
    return task.projectId;
  },

  // 删除任务
  async delete(projectId: string): Promise<void> {
    return await db.prdTasks.delete(projectId);
  },

  // 获取所有未完成的任务
  async getIncomplete(): Promise<PRDGenerationTaskPersisted[]> {
    return await db.prdTasks.where('phase').equals('generating').toArray();
  },

  // 清理已完成的任务（1天前）
  async cleanupCompleted(): Promise<number> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const completedTasks = await db.prdTasks
      .where('phase')
      .equals('completed')
      .and(task => task.updatedAt < cutoff)
      .toArray();
    
    const ids = completedTasks.map(t => t.projectId);
    return await db.prdTasks.bulkDelete(ids).then(() => ids.length);
  }
};

// PRD版本历史操作函数
export const prdVersionsDB = {
  // 获取项目的所有版本
  async getByProject(projectId: string): Promise<PRDVersion[]> {
    return await db.prdVersions
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('createdAt');
  },

  // 获取单个版本
  async get(id: string): Promise<PRDVersion | undefined> {
    return await db.prdVersions.get(id);
  },

  // 保存新版本
  async create(version: PRDVersion): Promise<string> {
    await db.prdVersions.add(version);
    return version.id;
  },

  // 删除版本
  async delete(id: string): Promise<void> {
    return await db.prdVersions.delete(id);
  },

  // 删除项目的所有版本
  async deleteByProject(projectId: string): Promise<number> {
    return await db.prdVersions.where('projectId').equals(projectId).delete();
  },

  // 获取项目版本数量
  async countByProject(projectId: string): Promise<number> {
    return await db.prdVersions.where('projectId').equals(projectId).count();
  },

  // 清理旧版本（保留最近10个）
  async cleanupOld(projectId: string, keepCount: number = 10): Promise<number> {
    const versions = await this.getByProject(projectId);
    if (versions.length <= keepCount) return 0;
    
    const toDelete = versions.slice(keepCount);
    const ids = toDelete.map(v => v.id);
    return await db.prdVersions.bulkDelete(ids).then(() => ids.length);
  }
};

// ========== 翻译任务操作函数 ==========
export const translationTasksDB = {
  // 获取指定任务
  async get(taskId: string): Promise<TranslationTaskPersisted | undefined> {
    return await db.translationTasks.get(taskId);
  },

  // 获取项目的所有翻译任务
  async getByProject(projectId: string): Promise<TranslationTaskPersisted[]> {
    return await db.translationTasks.where('projectId').equals(projectId).toArray();
  },

  // 保存或更新任务
  async save(task: Omit<TranslationTaskPersisted, 'updatedAt'>): Promise<string> {
    const taskWithTime: TranslationTaskPersisted = {
      ...task,
      updatedAt: Date.now()
    };
    await db.translationTasks.put(taskWithTime);
    return task.id;
  },

  // 删除任务
  async delete(taskId: string): Promise<void> {
    return await db.translationTasks.delete(taskId);
  },

  // 获取所有进行中的任务
  async getInProgress(): Promise<TranslationTaskPersisted[]> {
    return await db.translationTasks.where('phase').equals('translating').toArray();
  },

  // 清理已完成的任务（1天前）
  async cleanupCompleted(): Promise<number> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const completedTasks = await db.translationTasks
      .where('phase')
      .equals('completed')
      .and(task => task.updatedAt < cutoff)
      .toArray();
    
    const ids = completedTasks.map(t => t.id);
    return await db.translationTasks.bulkDelete(ids).then(() => ids.length);
  }
};

// ========== 翻译缓存操作函数 ==========
export const translationCacheDB = {
  // 根据cacheId获取缓存
  async get(cacheId: string): Promise<TranslationCache | undefined> {
    return await db.translationCache.get(cacheId);
  },

  // 根据内容hash和语言代码获取缓存
  async getByHashAndLang(contentHash: string, langCode: string): Promise<TranslationCache | undefined> {
    return await db.translationCache
      .where('contentHash')
      .equals(contentHash)
      .and(cache => cache.langCode === langCode)
      .first();
  },

  // 获取项目的所有缓存
  async getByProject(projectId: string): Promise<TranslationCache[]> {
    return await db.translationCache.where('projectId').equals(projectId).toArray();
  },

  // 保存缓存
  async save(cache: Omit<TranslationCache, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<string> {
    const now = Date.now();
    const cacheWithTime: TranslationCache = {
      ...cache,
      createdAt: cache.createdAt || now,
      updatedAt: now
    };
    await db.translationCache.put(cacheWithTime);
    return cache.id;
  },

  // 删除缓存
  async delete(cacheId: string): Promise<void> {
    return await db.translationCache.delete(cacheId);
  },

  // 删除项目的所有缓存
  async deleteByProject(projectId: string): Promise<number> {
    return await db.translationCache.where('projectId').equals(projectId).delete();
  },

  // 清理过期缓存（7天前）
  async cleanupOld(): Promise<number> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldCaches = await db.translationCache
      .where('updatedAt')
      .below(cutoff)
      .toArray();
    
    const ids = oldCaches.map(c => c.id);
    return await db.translationCache.bulkDelete(ids).then(() => ids.length);
  }
};

export default db;
