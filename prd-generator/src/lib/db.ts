import Dexie, { type EntityTable } from 'dexie';
import type { Project, Settings } from '@/types';
import { encryptApiKeys, decryptApiKeys, isEncrypted } from './crypto';

// 定义数据库类
class PRDDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('PRDGeneratorDB');
    
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt, status',
      settings: 'id'
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
      // 检查是否已加密，如果是则解密
      const firstKey = Object.values(settings.apiKeys)[0];
      if (firstKey && isEncrypted(firstKey)) {
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

export default db;
