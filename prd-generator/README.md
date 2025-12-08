# PRD Generator

AI 驱动的 PRD 生成与管理工具，基于 Next.js 16 + React 19，前端本地持久化（Dexie）与 API Key 加密存储。

## 功能特性
- 项目与对话：模板/自由描述创建项目，标签与关键词筛选；AI 逐轮提问（radio/checkbox/dropdown/text 选择器），本地草稿自动保存，支持取消/重试。
- PRD 生成与编辑：基于对话一键生成 PRD，SSE 流式输出、请求去重和中断恢复；Markdown 预览/编辑双模式，自动保存版本、版本历史及恢复。
- 导出与分享：导出 Markdown/PDF/Word；生成分享链接（可设密码与过期时间），分享页支持在线预览与复制。
- 多语言与复制：内置多语言翻译（分块翻译、结果缓存），一键复制到常见 AI 工具。
- AI 分析：对生成的 PRD 进行优化建议、质量评分、竞品分析、Mermaid 架构/流程/ER 图生成（带格式校验与自动重试）。
- 设置与安全：支持 DeepSeek/Qwen/Doubao 或自定义 API（域名白名单校验）；API Key 使用设备指纹加密后存储本地；主题切换、默认导出格式配置。

## 主要技术栈
- Next.js 16 (App Router) / React 19 / TypeScript / Tailwind
- Zustand 状态管理，Dexie 本地数据库
- `@uiw/react-md-editor` Markdown 编辑器，`react-markdown` + `remark-gfm` 渲染
- 流式 SSE 处理、CryptoJS 加密、lz-string 压缩

## 快速开始
```bash
npm install          # 安装依赖
npm run dev          # 启动开发环境，默认端口 3000（预启动会检查端口占用）
npm run build && npm run start   # 生产构建与本地运行

# 测试
npm test             # 运行 Jest 测试
npm run test:coverage
```
访问 `http://localhost:3000` 使用。

## 使用说明
- 新建项目：可选内置模板或自由描述，创建后跳转到 `/project/[id]/chat` 进入问答流程。
- 对话生成：AI 输出结构化问题，前端校验 JSON 后渲染选择器；支持批量提交答案、取消、错误重试。
- 生成 PRD：在对话页点击“生成 PRD”跳转 `/project/[id]/prd?generate=true`，流式生成；可手动编辑、自动保存版本、导出/分享/翻译/分析。
- 分享：分享链接可选密码和过期时间，接收方在 `/share?d=...` 查看，只读导出。
- 设置：在 `/settings` 配置默认模型与各模型 API Key（必填），可自定义 API URL + 模型名（域名有白名单校验）。

## 本地持久化数据
- `projects`：项目、对话、PRD 内容与元数据
- `settings`：全局设置，API Key 加密后存储
- `chatDrafts`：未提交的选择器草稿
- `prdTasks`：PRD 生成任务进度（支持中断恢复）
- `prdVersions`：版本快照（自动/手动保存）
- `translationTasks` / `translationCache`：翻译任务与结果缓存
- `analysisResults`：AI 分析结果缓存

## 测试与质量
- Jest 单元/集成测试（含 SSE 去重逻辑、翻译缓存等），可用 `npm test` 或 `npm run test:ci` 运行。
- ESLint 已配置：`npm run lint`。
