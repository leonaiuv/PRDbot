import Dexie, { type EntityTable } from 'dexie';
import type { Project, Settings } from '@/types';

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
  // 获取设置
  async get(): Promise<Settings | undefined> {
    return await db.settings.get('global');
  },

  // 保存设置
  async save(settings: Omit<Settings, 'id'>): Promise<string> {
    const fullSettings: Settings = {
      id: 'global',
      ...settings
    };
    await db.settings.put(fullSettings);
    return 'global';
  },

  // 更新设置
  async update(updates: Partial<Settings>): Promise<void> {
    const current = await this.get();
    if (current) {
      await db.settings.update('global', updates);
    } else {
      await this.save({
        apiKeys: {},
        defaultModel: 'deepseek',
        exportPreferences: { defaultFormat: 'md' },
        ...updates
      });
    }
  },

  // 获取或创建默认设置
  async getOrCreate(): Promise<Settings> {
    let settings = await this.get();
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
