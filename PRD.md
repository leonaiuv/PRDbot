# PRD 文档生成工具 - 产品需求文档

## 1. 产品概述

### 1.1 产品定位
PRD 文档生成工具是一个基于 AI 的智能引导式 PRD 文档编写助手，旨在帮助缺乏产品设计经验的用户，通过 AI 多轮对话引导，将模糊的产品想法转化为结构化、完整的产品需求文档（PRD）。

### 1.2 核心价值
- **降低门槛**：让非产品经理也能生成专业的 PRD 文档
- **提升效率**：通过 AI 引导和选择器交互，减少用户输入成本
- **面向 AI 工程师**：生成的 PRD 文档既便于人类审阅，也适合 AI 工程师理解和实现
- **智能优化**：提供竞品分析和 AI 优化建议，提升 PRD 质量

### 1.3 目标用户
- 想要通过 AI 编程构建产品，但缺乏产品设计能力的开发者
- 有创意但不知道如何系统化表达需求的创业者
- 需要快速输出 PRD 文档原型的产品新手
- 希望借助 AI 完善产品思路的任何用户

---

## 2. 核心功能详述

### 2.1 多项目管理

#### 2.1.1 项目列表页
- **功能**：展示用户所有的 PRD 项目草稿
- **信息展示**：
  - 项目名称（从用户初始输入或 AI 生成）
  - 创建时间
  - 最后修改时间
  - 项目状态（需求探索中、PRD 已生成、已导出等）
  - 完成进度（例如：已回答 8/15 个问题）
- **操作**：
  - 创建新项目
  - 继续编辑项目
  - 删除项目
  - 导出项目 PRD
  - 搜索/筛选项目

#### 2.1.2 本地存储
- 使用 `IndexedDB` 存储项目数据
- 每个项目包含：
  - 项目元数据（ID、名称、时间戳等）
  - 对话历史（用户输入 + AI 回复 + 用户选择）
  - 生成的 PRD 文档内容
  - 用户配置（API Key、选择的 AI 模型等）

---

### 2.2 AI 引导式对话系统

#### 2.2.1 初始输入
- 用户输入一句话或模糊的产品描述
- 示例：
  - "帮我生成一个文生图应用"
  - "我想做一个在线协作白板工具"
  - "类似小红书的内容分享平台"

#### 2.2.2 动态问答机制
- **问答轮次**：
  - 不固定轮数，最多 20 轮
  - 每轮可包含 1 个或多个相关问题
  - AI 根据用户回答动态调整后续问题
- **问题类型**：
  - 用户背景（是否有开发经验、技术栈偏好）
  - 功能需求（核心功能、可选功能、优先级）
  - UI/UX 期望（布局风格、交互方式、参考案例）
  - 技术选型建议（前端框架、后端语言、数据库等）
  - 数据模型（用户数据、业务数据结构）
  - 性能与扩展性（预期用户量、并发需求）
  - 竞品对比（是否有参考竞品）
- **问题不重复原则**：
  - 具体问题不重复，但可以从不同角度深挖同一主题
  - 示例：不会重复问"你需要哪些功能"，但可以问"这个功能是否需要支持多人协作"

#### 2.2.3 结束条件
1. 用户主动点击"开始生成 PRD"按钮
2. AI 判断信息已足够完整（通过内部评估机制）
3. 达到 20 轮上限

---

### 2.3 智能选择器系统

#### 2.3.1 选择器类型
AI 根据问题内容智能选择合适的交互组件：

| 场景 | 组件类型 | 示例 |
|------|---------|------|
| 单一选择（互斥） | Radio 单选按钮 | "你是否有后端开发经验？" → 有/无/由 AI 决定 |
| 多个选择（可叠加） | Checkbox 多选框 | "你希望应用包含哪些功能？" → 用户登录、评论系统、分享功能... |
| 选项较多 | Dropdown 下拉菜单 | "推荐的前端框架？" → React/Vue/Angular/Svelte... |
| 开放输入 | Text Input + 建议选项 | "参考竞品名称？" → 输入框 + AI 推荐列表 |

#### 2.3.2 "由 AI 决定" 选项
- 每个问题都提供 "由 AI 决定" 选项
- 用户选择后，AI 自动选择最佳答案并继续下一个问题
- AI 的选择会在 PRD 文档中标注为 "AI 推荐"

#### 2.3.3 选择器数据格式
AI 回复中需要包含结构化数据，示例：

```json
{
  "question": "你是否有后端开发经验？",
  "type": "radio",
  "options": [
    { "value": "experienced", "label": "有，我熟悉后端开发" },
    { "value": "basic", "label": "了解基础，但需要指导" },
    { "value": "none", "label": "没有，希望使用无需后端的方案" },
    { "value": "ai_decide", "label": "由 AI 决定" }
  ],
  "required": true
}
```

---

### 2.4 PRD 实时生成与编辑

#### 2.4.1 两阶段 UI 模式

**阶段 1：需求探索阶段**
- 全屏对话界面
- 类似聊天应用的交互
- 用户可随时查看已回答的问题摘要

**阶段 2：PRD 生成阶段**
- 左右分栏布局
  - **左侧**：继续 AI 对话（补充细节、优化建议）
  - **右侧**：实时预览 PRD 文档（支持在线编辑）
- 切换时机：用户点击 "开始生成 PRD" 或 AI 判断信息足够

#### 2.4.2 PRD 文档结构

生成的 PRD 文档包含以下章节：

1. **产品概述**
   - 产品名称
   - 产品定位（一句话描述）
   - 核心价值主张
   - 目标用户

2. **功能需求**
   - 核心功能列表（按优先级排序）
   - 每个功能的详细说明
   - 功能依赖关系

3. **UI/UX 设计**
   - 页面结构
   - 布局风格
   - 交互流程
   - 参考设计（如果用户提供）

4. **技术架构建议**
   - 前端技术栈
   - 后端技术栈
   - 第三方服务（API、云服务等）
   - 数据库选型
   - **重点**：每个建议都说明理由和适用场景

5. **数据模型**
   - 核心数据实体
   - 字段定义
   - 关系说明

6. **技术实现要点**
   - 关键技术难点
   - 推荐的实现方案
   - 注意事项

7. **竞品分析**（如果用户提供竞品信息）
   - 竞品功能对比
   - 技术栈对比
   - 优缺点分析

8. **优化建议**
   - AI 自动生成的优化建议
   - 潜在风险点
   - 后续迭代方向

**注意**：文档中不包含时间规划、人力安排等内容，因为面向 AI 工程师。

#### 2.4.3 实时编辑功能
- 用户可以直接在右侧编辑 PRD 内容
- 编辑后的内容会作为上下文传递给左侧的 AI 对话
- AI 会避免重复询问已确认的内容或跑题
- 支持 Markdown 格式编辑

---

### 2.5 导出功能

#### 2.5.1 支持格式
1. **Markdown** (.md)
   - 前端直接生成，使用 `file-saver` 库
2. **PDF** (.pdf)
   - 后端生成，使用 `puppeteer` 或 `pdfkit`
3. **Word** (.docx)
   - 后端生成，使用 `docx` 库

#### 2.5.2 导出流程
1. 用户点击导出按钮，选择格式
2. 前端发送 PRD Markdown 内容到后端
3. 后端转换为对应格式
4. 返回文件下载链接或直接返回文件流
5. 前端触发下载

---

### 2.6 竞品分析模块

#### 2.6.1 触发时机
- 在对话过程中，AI 询问 "是否有参考的竞品？"
- 用户可以手动输入竞品名称
- 或者选择 "由 AI 自动识别"

#### 2.6.2 分析流程
1. **用户输入竞品名称** → AI 搜索竞品信息
2. **AI 自动识别** → 根据用户的产品描述，AI 推荐 3-5 个竞品
3. **用户确认** → 用户从 AI 推荐列表中选择
4. **生成分析** → AI 生成竞品分析表格

#### 2.6.3 分析维度
- **功能对比**：核心功能、差异化功能
- **技术栈**：前端、后端、数据库、云服务
- **优缺点**：用户体验、性能、扩展性
- **启发点**：可借鉴的设计或技术方案

---

### 2.7 AI 自动优化建议

#### 2.7.1 触发时机
- PRD 生成后，AI 自动分析文档
- 或者用户主动点击 "请 AI 优化建议"

#### 2.7.2 优化维度
- **功能完整性**：是否有遗漏的关键功能
- **技术合理性**：技术栈选择是否合适
- **数据模型**：是否有冗余或缺失的字段
- **用户体验**：是否有体验优化点
- **性能与扩展性**：潜在的性能瓶颈

#### 2.7.3 展示方式
- 在 PRD 文档末尾生成 "AI 优化建议" 章节
- 每条建议包含：
  - 问题描述
  - 优化建议
  - 预期效果

---

## 3. UI/UX 设计规范

### 3.1 设计风格
- **参考**：shadcn/ui 的黑白简约风格
- **色彩**：
  - 主色调：黑白灰
  - 强调色：蓝色（按钮、链接）
  - 背景：浅灰色（#F9FAFB）或纯白
- **字体**：
  - 中文：PingFang SC / Microsoft YaHei
  - 英文/代码：Inter / JetBrains Mono
- **组件库**：shadcn/ui

### 3.2 页面结构

#### 3.2.1 项目列表页
```
+--------------------------------------------------+
|  [Logo]  PRD 生成工具          [新建项目]         |
+--------------------------------------------------+
|                                                  |
|  [搜索框]                                        |
|                                                  |
|  +--------------------+  +--------------------+  |
|  | 项目 1              |  | 项目 2              |  |
|  | 文生图应用          |  | 协作白板工具        |  |
|  | 进度: 12/15         |  | 进度: 已完成        |  |
|  | 2024-12-06         |  | 2024-12-05         |  |
|  | [继续] [删除]       |  | [查看] [导出]       |  |
|  +--------------------+  +--------------------+  |
|                                                  |
+--------------------------------------------------+
```

#### 3.2.2 对话页面（需求探索阶段）
```
+--------------------------------------------------+
|  [< 返回]  项目名称                    [设置]     |
+--------------------------------------------------+
|                                                  |
|  AI: 你好！请描述你想要构建的产品...              |
|                                                  |
|  用户: 帮我生成一个文生图应用                     |
|                                                  |
|  AI: 你是否有后端开发经验？                       |
|  [ ] 有，我熟悉后端开发                          |
|  [ ] 了解基础，但需要指导                        |
|  [x] 没有，希望使用无需后端的方案                |
|  [ ] 由 AI 决定                                  |
|                                                  |
|                            [上一步] [继续] -----> |
+--------------------------------------------------+
|  [输入框...]                            [发送]    |
+--------------------------------------------------+
```

#### 3.2.3 PRD 生成页面（左右分栏）
```
+--------------------------------------------------+
|  [< 返回]  项目名称        [导出] [设置]          |
+--------------------------------------------------+
| 对话区 (40%)        |  PRD 预览区 (60%)           |
|                    |                             |
| AI: PRD 已生成，    |  # 产品概述                 |
| 你可以继续补充...   |  ## 产品定位                |
|                    |  文生图应用是...            |
| [输入框] [发送]     |  [可编辑的 Markdown 区域]   |
|                    |                             |
|                    |  [实时保存中...]            |
+--------------------------------------------------+
```

### 3.3 交互细节
- **加载状态**：AI 思考时显示打字动画
- **反馈**：用户操作后立即显示 Toast 提示
- **保存**：自动保存，无需手动操作
- **响应式**：支持桌面端和平板（移动端体验降级）

---

## 4. 技术架构

### 4.1 技术栈

#### 4.1.1 前端
- **框架**：Next.js 14+ (App Router)
- **UI 库**：shadcn/ui + Tailwind CSS
- **状态管理**：Zustand 或 React Context
- **本地存储**：Dexie.js (IndexedDB 封装)
- **Markdown 编辑器**：react-markdown + codemirror 或 tiptap
- **文件导出**：file-saver (Markdown 导出)

#### 4.1.2 后端
- **运行时**：Node.js 18+
- **框架**：Express 或 Fastify
- **文档生成**：
  - PDF: `puppeteer` 或 `pdfkit`
  - Word: `docx`
- **其他**：CORS、日志记录（winston）

#### 4.1.3 AI 集成
- **支持的模型**：
  - 自定义第三方 API 路由
  - DeepSeek
  - Qwen
  - Doubao
- **API 密钥管理**：
  - 用户在设置页面输入 API Key
  - 存储在浏览器 LocalStorage（加密）
  - 每次请求时由前端携带到后端，后端转发给 AI 服务

### 4.2 系统架构图

```
+---------------------+
|   用户浏览器         |
|  +--------------+   |
|  | Next.js App  |   |
|  | (React)      |   |
|  +--------------+   |
|        |            |
|        v            |
|  +--------------+   |
|  | IndexedDB    |   |
|  | (本地存储)    |   |
|  +--------------+   |
+--------|------------+
         |
         | API 请求
         v
+---------------------+
|  Node.js 后端       |
|  +--------------+   |
|  | AI 代理      |   |
|  | (转发请求)   |   |
|  +--------------+   |
|  | 文档导出     |   |
|  | (PDF/Word)   |   |
|  +--------------+   |
+--------|------------+
         |
         | HTTP 请求
         v
+---------------------+
|  AI 服务商 API      |
|  - DeepSeek         |
|  - Qwen             |
|  - Doubao           |
|  - 自定义路由       |
+---------------------+
```

### 4.3 后端职责

#### 4.3.1 AI API 代理
- **目的**：避免前端直接暴露 API Key
- **实现**：
  - 前端发送请求到 `/api/chat`
  - 后端接收请求，携带用户的 API Key 转发给 AI 服务
  - 支持流式响应（SSE）
  - 错误处理和重试

#### 4.3.2 文档导出服务
- **PDF 生成**：
  - 接收 Markdown 内容
  - 使用 `marked` 转换为 HTML
  - 使用 `puppeteer` 渲染为 PDF
  - 返回 PDF 文件流
- **Word 生成**：
  - 接收 Markdown 内容
  - 解析 Markdown 结构
  - 使用 `docx` 库生成 .docx 文件
  - 返回文件流

#### 4.3.3 可选功能
- **请求日志**：记录 API 调用情况（不记录用户敏感信息）
- **错误监控**：集成 Sentry 或类似服务
- **缓存**：缓存 AI 回复（可选）

---

## 5. 数据模型

### 5.1 本地存储结构（IndexedDB）

#### 5.1.1 Object Store: `projects`
存储所有项目的元数据和内容。

```typescript
interface Project {
  id: string;                    // 唯一标识，UUID
  name: string;                  // 项目名称
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  status: 'exploring' | 'generated' | 'exported'; // 状态
  initialInput: string;          // 用户初始输入
  conversation: ConversationMessage[]; // 对话历史
  prdContent: string;            // 生成的 PRD Markdown 内容
  metadata: {
    questionCount: number;       // 已回答问题数
    progress: number;            // 完成进度 0-100
    selectedModel: string;       // 用户选择的 AI 模型
  };
}
```

#### 5.1.2 对话消息格式
```typescript
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
  content: string;               // 消息内容
  selector?: SelectorData;       // 如果是 AI 消息，可能包含选择器数据
  userChoice?: UserChoice;       // 如果是用户消息，包含用户的选择
}

interface SelectorData {
  type: 'radio' | 'checkbox' | 'dropdown' | 'text';
  question: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  required: boolean;
}

interface UserChoice {
  selectorId: string;
  selectedValues: string[];     // 单选是数组长度为 1，多选可以多个
}
```

#### 5.1.3 Object Store: `settings`
存储用户设置。

```typescript
interface Settings {
  id: 'global';                  // 固定 ID
  apiKeys: {
    [provider: string]: string;  // 例如 { 'deepseek': 'sk-xxx' }
  };
  defaultModel: string;          // 默认 AI 模型
  exportPreferences: {
    defaultFormat: 'md' | 'pdf' | 'docx';
  };
}
```

---

## 6. 关键交互流程

### 6.1 完整用户流程

```
1. 用户打开应用
   ↓
2. 进入项目列表页
   ↓
3. 点击 "新建项目"
   ↓
4. 输入初始产品描述
   ↓
5. AI 开始多轮引导式提问
   ├─ 用户通过选择器回答
   ├─ 或选择 "由 AI 决定"
   ├─ 对话历史实时保存
   ↓
6. 用户点击 "开始生成 PRD" 或 AI 判断信息足够
   ↓
7. 切换到左右分栏模式
   ├─ 左侧：继续对话（补充/优化）
   ├─ 右侧：实时预览 PRD 文档
   ├─ 用户可编辑 PRD 内容
   ↓
8. 用户满意后，点击 "导出"
   ↓
9. 选择导出格式（Markdown/PDF/Word）
   ↓
10. 下载 PRD 文档
```

### 6.2 AI 对话流程（状态机）

```
[初始状态]
   ↓
   接收用户初始输入
   ↓
[分析阶段]
   ├─ AI 解析用户意图
   ├─ 确定需要询问的维度（用户背景、功能、UI、技术等）
   ↓
[提问阶段] ────┐
   ├─ 生成问题 + 选择器          |
   ├─ 等待用户回答              |
   ├─ 收到用户回答              |
   ├─ 更新上下文               |
   ├─ 判断是否需要继续提问       |
   │   - 是 → 回到提问阶段 ──────┘
   │   - 否 ↓
[生成阶段]
   ├─ 汇总所有信息
   ├─ 生成 PRD 文档
   ├─ 展示给用户
   ↓
[优化阶段]
   ├─ 用户编辑 PRD
   ├─ AI 提供优化建议
   ├─ 竞品分析（如果需要）
   ↓
[完成]
```

### 6.3 "由 AI 决定" 逻辑

当用户选择 "由 AI 决定" 时：

1. 前端记录用户的选择
2. 发送给后端，标记为 `ai_auto_select: true`
3. 后端调用 AI，要求 AI 自动选择最佳答案
4. AI 返回选择的答案和理由
5. 前端展示 AI 的选择：
   ```
   AI 已自动选择：没有，希望使用无需后端的方案
   理由：根据你的需求，前端框架 + 云服务（如 Supabase）可以快速实现...
   ```
6. 自动继续下一个问题

---

## 7. AI 提示词设计要点

### 7.1 系统提示词（System Prompt）

```markdown
你是一个专业的产品需求分析助手，你的任务是通过多轮对话，帮助用户将模糊的产品想法转化为结构化的 PRD 文档。

**核心原则：**
1. 你的问题应该面向用户期望的结果，而不是技术细节。用户可能不懂技术架构，所以要用通俗的语言。
2. 每次提问时，生成 1-3 个相关问题，并提供选择器（单选/多选/下拉/输入框）。
3. 根据用户的回答，动态调整后续问题，避免重复询问已确认的内容。
4. 当用户选择 "由 AI 决定" 时，你需要给出最佳建议和理由。
5. 最多 20 轮对话，或者当你判断信息足够完整时，提示用户生成 PRD。
6. 生成的 PRD 文档要面向 AI 工程师，包含技术实现建议，但不需要时间规划。

**问题维度：**
- 用户背景（技术能力、开发经验）
- 核心功能（必须有哪些功能）
- 用户体验（UI 风格、交互方式、参考案例）
- 数据结构（需要存储哪些数据）
- 技术建议（前端、后端、数据库、云服务等）
- 扩展性（未来可能的迭代方向）

**输出格式：**
每次回复必须包含 JSON 格式的选择器数据，例如：
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "你是否有后端开发经验？",
      "type": "radio",
      "options": [
        { "value": "experienced", "label": "有，我熟悉后端开发" },
        { "value": "basic", "label": "了解基础，但需要指导" },
        { "value": "none", "label": "没有，希望使用无需后端的方案" },
        { "value": "ai_decide", "label": "由 AI 决定" }
      ],
      "required": true
    }
  ]
}
```
```

### 7.2 PRD 生成提示词

```markdown
现在请根据以下对话历史，生成一份完整的 PRD 文档。

**对话历史：**
{conversation_history}

**PRD 结构要求：**
1. 产品概述（产品名称、定位、核心价值、目标用户）
2. 功能需求（核心功能列表，按优先级排序，每个功能详细说明）
3. UI/UX 设计（页面结构、布局风格、交互流程、参考设计）
4. 技术架构建议（前端、后端、数据库、第三方服务，每个建议说明理由）
5. 数据模型（核心数据实体、字段定义、关系说明）
6. 技术实现要点（关键技术难点、推荐方案、注意事项）
7. 竞品分析（如果有，包含功能对比、技术栈对比、优缺点）
8. 优化建议（自动生成的优化建议、潜在风险、后续迭代方向）

**注意：**
- 文档面向 AI 工程师，不需要时间规划和人力安排
- 技术建议要具体，说明为什么选择这个技术栈
- 数据模型要清晰，包含字段类型和关系
- 使用 Markdown 格式输出
```

### 7.3 优化建议提示词

```markdown
请分析以下 PRD 文档，并提供优化建议：

**PRD 文档：**
{prd_content}

**分析维度：**
1. 功能完整性：是否有遗漏的关键功能？
2. 技术合理性：技术栈选择是否合适？
3. 数据模型：是否有冗余或缺失的字段？
4. 用户体验：是否有体验优化点？
5. 性能与扩展性：潜在的性能瓶颈和扩展性问题？

**输出格式：**
每条建议包含：
- 问题描述
- 优化建议
- 预期效果
```

---

## 8. 导出功能实现

### 8.1 前端实现（Markdown）

```typescript
// utils/export.ts
import { saveAs } from 'file-saver';

export function exportMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${filename}.md`);
}
```

### 8.2 后端实现（PDF）

```typescript
// backend/services/pdf-export.ts
import puppeteer from 'puppeteer';
import { marked } from 'marked';

export async function generatePDF(markdownContent: string): Promise<Buffer> {
  // 1. 将 Markdown 转换为 HTML
  const html = marked.parse(markdownContent);

  // 2. 添加样式
  const styledHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'PingFang SC', sans-serif; padding: 40px; }
          h1 { color: #000; font-size: 32px; }
          h2 { color: #333; font-size: 24px; margin-top: 30px; }
          code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  // 3. 使用 Puppeteer 生成 PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(styledHtml);
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
  });
  await browser.close();

  return pdfBuffer;
}
```

### 8.3 后端实现（Word）

```typescript
// backend/services/word-export.ts
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

export async function generateWord(markdownContent: string): Promise<Buffer> {
  // 简单示例：将 Markdown 解析为段落（实际需要更完善的解析）
  const lines = markdownContent.split('\n');
  const paragraphs = lines.map(line => {
    if (line.startsWith('# ')) {
      return new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1
      });
    } else if (line.startsWith('## ')) {
      return new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2
      });
    } else {
      return new Paragraph({ text: line });
    }
  });

  const doc = new Document({
    sections: [{ children: paragraphs }]
  });

  return await Packer.toBuffer(doc);
}
```

### 8.4 API 端点

```typescript
// backend/routes/export.ts
import express from 'express';
import { generatePDF } from '../services/pdf-export';
import { generateWord } from '../services/word-export';

const router = express.Router();

router.post('/export/pdf', async (req, res) => {
  const { content } = req.body;
  const pdfBuffer = await generatePDF(content);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=prd.pdf');
  res.send(pdfBuffer);
});

router.post('/export/word', async (req, res) => {
  const { content } = req.body;
  const wordBuffer = await generateWord(content);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename=prd.docx');
  res.send(wordBuffer);
});

export default router;
```

---

## 9. 竞品分析模块实现

### 9.1 触发流程

1. **AI 提问阶段**，询问用户 "是否有参考的竞品？"
2. 用户选择：
   - 手动输入竞品名称
   - 由 AI 自动识别并推荐
   - 跳过

### 9.2 AI 自动识别竞品

```markdown
**提示词：**
根据用户的产品描述，推荐 3-5 个相关竞品。

**用户产品描述：**
{user_initial_input}

**输出格式：**
```json
{
  "competitors": [
    { "name": "Midjourney", "description": "AI 文生图工具，以艺术风格见长" },
    { "name": "Stable Diffusion", "description": "开源 AI 图像生成模型" },
    { "name": "DALL-E", "description": "OpenAI 的文生图产品" }
  ]
}
```
```

### 9.3 竞品分析生成

```markdown
**提示词：**
请分析以下竞品，从功能、技术栈、优缺点等维度对比。

**竞品列表：**
{selected_competitors}

**用户产品：**
{user_product_description}

**输出格式：**
| 维度 | 用户产品 | 竞品 A | 竞品 B | 竞品 C |
|------|---------|--------|--------|--------|
| 核心功能 | ... | ... | ... | ... |
| 前端技术 | ... | ... | ... | ... |
| 后端技术 | ... | ... | ... | ... |
| 优点 | ... | ... | ... | ... |
| 缺点 | ... | ... | ... | ... |
| 启发点 | ... | ... | ... | ... |
```

---

## 10. 开发优先级和功能清单

### 10.1 MVP（第一版）核心功能

| 功能模块 | 优先级 | 说明 |
|---------|-------|------|
| 项目列表页 | P0 | 创建、查看、删除项目 |
| AI 引导式对话 | P0 | 动态问答、选择器、"由 AI 决定" |
| 本地存储 | P0 | IndexedDB 存储项目和对话历史 |
| PRD 实时生成 | P0 | 左右分栏、实时预览 |
| Markdown 导出 | P0 | 前端直接导出 .md 文件 |
| API Key 配置 | P0 | 设置页面，支持多个 AI 模型 |
| AI API 代理 | P0 | 后端转发 AI 请求 |

### 10.2 第二版功能

| 功能模块 | 优先级 | 说明 |
|---------|-------|------|
| PDF 导出 | P1 | 后端生成 PDF |
| Word 导出 | P1 | 后端生成 .docx |
| PRD 在线编辑 | P1 | 右侧支持实时编辑 |
| 竞品分析模块 | P1 | AI 自动识别竞品并生成对比表 |
| AI 优化建议 | P1 | 自动分析 PRD 并提供优化建议 |

### 10.3 未来迭代功能

| 功能模块 | 优先级 | 说明 |
|---------|-------|------|
| PRD 模板库 | P2 | 提供常见产品类型的模板 |
| 多人协作 | P2 | 支持分享链接，团队成员共同编辑 |
| 云端同步 | P2 | 可选的云端存储（需要登录系统） |
| AI 自动生成 UI 原型 | P2 | 根据 PRD 生成低保真原型图 |
| 集成 AI 编程工具 | P2 | 一键将 PRD 发送到 Cursor/Claude Code 等工具 |

---

## 11. 技术实现关键点

### 11.1 AI 选择器数据传输

**前端解析 AI 回复：**
- AI 回复包含结构化 JSON（选择器数据）+ 纯文本（解释说明）
- 前端需要解析并分离两部分内容

**示例 AI 回复：**
```
根据你的需求，我需要了解你的技术背景，这样才能给出更合适的建议。

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "你是否有后端开发经验？",
      "type": "radio",
      "options": [
        { "value": "experienced", "label": "有，我熟悉后端开发" },
        { "value": "basic", "label": "了解基础，但需要指导" },
        { "value": "none", "label": "没有，希望使用无需后端的方案" },
        { "value": "ai_decide", "label": "由 AI 决定" }
      ],
      "required": true
    }
  ]
}
```
```

**前端解析逻辑：**
```typescript
function parseAIResponse(response: string) {
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    const selectorData = JSON.parse(jsonMatch[1]);
    const textContent = response.replace(/```json\n[\s\S]*?\n```/, '').trim();
    return { textContent, selectorData };
  }
  return { textContent: response, selectorData: null };
}
```

### 11.2 编辑内容作为上下文

**实现方式：**
- 用户在右侧编辑 PRD 内容时，debounce 500ms 后保存到 IndexedDB
- 左侧继续对话时，将编辑后的 PRD 内容作为上下文发送给 AI

**提示词示例：**
```markdown
**当前 PRD 文档：**
{edited_prd_content}

**注意：**
用户已经手动编辑了上述 PRD 内容，请基于此内容继续对话，避免重复询问已确认的内容。
```

### 11.3 问题不重复机制

**实现方式：**
- 在系统提示词中要求 AI 记录已询问的问题类型
- 每次生成新问题前，AI 检查历史对话，避免重复

**提示词补充：**
```markdown
**已询问的问题维度：**
{asked_dimensions}

请确保新问题不重复上述维度的具体问题，但可以从不同角度深入探讨。
```

### 11.4 流式响应（SSE）

**后端实现：**
```typescript
router.post('/api/chat', async (req, res) => {
  const { messages, apiKey, model } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await callAIService(messages, apiKey, model);

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});
```

**前端实现：**
```typescript
async function streamChat(messages: Message[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, apiKey, model })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.replace('data: ', '');
      if (data === '[DONE]') return;
      const { content } = JSON.parse(data);
      // 更新 UI
      updateChatMessage(content);
    }
  }
}
```

---

## 12. 设计稿参考（文字描述）

### 12.1 项目列表页
- **顶部导航栏**：
  - 左侧：Logo + 产品名称 "PRD 生成工具"
  - 右侧：按钮 "新建项目"（蓝色背景，白色文字）
- **搜索框**：
  - 居中，宽度 60%，带搜索图标
- **项目卡片**：
  - 网格布局，每行 3 列（响应式）
  - 卡片内容：
    - 项目名称（大字体）
    - 状态标签（需求探索中 / PRD 已生成 / 已导出）
    - 进度条或文字（例如：12/15 问题已回答）
    - 创建时间和最后修改时间
    - 操作按钮：继续 / 查看 / 导出 / 删除（红色）

### 12.2 对话页面
- **顶部导航栏**：
  - 左侧：返回按钮 + 项目名称
  - 右侧：设置按钮（齿轮图标）
- **对话区域**：
  - 全屏，类似聊天应用
  - AI 消息：左对齐，灰色背景气泡
  - 用户消息：右对齐，蓝色背景气泡
  - 选择器：嵌入在 AI 消息中，下方显示选项
- **底部输入框**：
  - 固定在底部
  - 左侧：输入框（支持多行）
  - 右侧：发送按钮（蓝色）

### 12.3 PRD 生成页面
- **左侧对话区（40% 宽度）**：
  - 继续显示对话历史
  - 用户可以继续补充需求或要求优化
- **右侧 PRD 预览区（60% 宽度）**：
  - 顶部：标签栏（预览 / 编辑）
  - 预览模式：渲染后的 Markdown
  - 编辑模式：Markdown 编辑器，支持实时预览
  - 底部：自动保存提示

---

## 13. 非功能性需求

### 13.1 性能
- **首屏加载时间**：< 2 秒
- **对话响应时间**：AI 流式响应，首字响应 < 1 秒
- **本地存储**：支持至少 100 个项目（每个项目约 500KB）

### 13.2 兼容性
- **浏览器**：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **设备**：桌面端优先，平板适配，移动端降级体验

### 13.3 安全性
- **API Key 加密**：LocalStorage 中的 API Key 使用 AES 加密
- **后端代理**：所有 AI 请求通过后端转发，前端不暴露 Key
- **XSS 防护**：用户输入和 AI 输出都需要转义

### 13.4 可扩展性
- **模块化设计**：AI 服务、导出服务、存储服务解耦
- **支持插件**：未来可以支持自定义 PRD 模板或导出格式

---

## 14. 附录

### 14.1 示例对话流程

**第 1 轮：**
- **AI**: 你好！请描述你想要构建的产品，一句话即可。
- **用户**: 帮我生成一个文生图应用。

**第 2 轮：**
- **AI**: 了解了！为了给你更合适的建议，我需要了解你的技术背景。
  - 问题 1: 你是否有后端开发经验？
    - [x] 没有，希望使用无需后端的方案
  - 问题 2: 你更熟悉哪种前端框架？
    - [ ] React
    - [x] Vue
    - [ ] 由 AI 决定

**第 3 轮：**
- **AI**: 好的！那我们使用 Vue + 云服务的方案。接下来，你希望应用包含哪些核心功能？
  - [x] 文字生成图片
  - [x] 图片风格选择
  - [ ] 图片编辑功能
  - [x] 历史记录查看
  - [ ] 分享到社交媒体
  - [ ] 由 AI 决定

**...**（持续 15-20 轮）

**最后一轮：**
- **AI**: 根据你的回答，我已经收集到足够的信息。点击下方按钮开始生成 PRD 文档吧！
  - [开始生成 PRD]

### 14.2 PRD 文档示例结构

```markdown
# 文生图应用 - 产品需求文档

## 1. 产品概述
### 1.1 产品定位
一个基于 AI 的文生图应用，用户输入文字描述即可生成图片...

### 1.2 目标用户
- 设计师、创作者
- 社交媒体运营者
- ...

## 2. 功能需求
### 2.1 核心功能
#### 2.1.1 文字生成图片
- 用户输入：文字描述
- AI 生成：图片
- 技术实现：调用 Stable Diffusion API

#### 2.1.2 图片风格选择
- 提供预设风格：写实、动漫、油画等
- ...

## 3. UI/UX 设计
### 3.1 页面结构
- 首页：输入框 + 生成按钮
- 历史页：瀑布流展示生成的图片
- ...

## 4. 技术架构建议
### 4.1 前端
- 框架：Vue 3 + Vite
- UI 库：Element Plus
- 理由：用户熟悉 Vue...

### 4.2 后端
- 方案：使用 Supabase 作为后端服务
- 理由：无需编写后端代码，提供认证、存储、数据库...

## 5. 数据模型
### 5.1 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户唯一标识 |
| email | String | 邮箱 |
| created_at | Timestamp | 创建时间 |

### 5.2 图片表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 图片唯一标识 |
| user_id | UUID | 用户 ID |
| prompt | Text | 文字描述 |
| image_url | String | 图片 URL |
| style | String | 风格 |
| created_at | Timestamp | 创建时间 |

## 6. 技术实现要点
### 6.1 AI API 调用
- 使用 Stable Diffusion API
- 注意：处理 API 限流，添加重试机制

### 6.2 图片存储
- 使用 Supabase Storage
- 注意：图片压缩和 CDN 加速

## 7. 竞品分析
| 维度 | 本产品 | Midjourney | DALL-E |
|------|--------|-----------|--------|
| 核心功能 | 文生图 | 文生图 | 文生图 |
| 技术栈 | Vue + Supabase | 自研 | OpenAI |
| 优点 | 免费、开源 | 图片质量高 | 易用性强 |
| 缺点 | 功能较简单 | 收费 | API 限流严格 |

## 8. 优化建议
1. 建议添加 "图片放大" 功能，提升用户体验
2. 建议支持批量生成，提升效率
3. ...
```

---

## 15. 总结

本 PRD 文档定义了一个 AI 驱动的 PRD 文档生成工具，核心特点包括：
- **智能引导**：通过 AI 多轮对话，将模糊需求转化为结构化文档
- **低门槛**：选择器交互减少用户输入成本，"由 AI 决定" 进一步降低决策负担
- **面向 AI 工程师**：生成的 PRD 文档包含技术实现细节，便于 AI 理解和执行
- **实时编辑**：支持用户在生成后继续优化和调整
- **多格式导出**：支持 Markdown、PDF、Word 三种格式

技术栈采用 React + Next.js + shadcn/ui（前端）+ Node.js（后端），数据存储在本地浏览器，支持多个 AI 模型（DeepSeek、Qwen、Doubao 等）。

第一版（MVP）专注于核心对话流程和 Markdown 导出，第二版增加 PDF/Word 导出、竞品分析和 AI 优化建议，未来可扩展模板库、多人协作、云端同步等功能。

---

**文档版本**: v1.0
**最后更新**: 2024-12-06
**生成工具**: Claude Code
