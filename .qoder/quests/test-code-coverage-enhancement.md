# 测试代码覆盖率增强设计文档

## 一、背景与目标

### 当前测试覆盖现状

根据现有测试总结，项目已完成87个单元测试，覆盖率约16.93%（458/2705 statements）。已覆盖模块包括：

- 数据持久化层（db.ts）：53个测试
- 状态管理层（store/index.ts）：34个测试  
- 加密工具（crypto.ts）：15个测试
- 校验工具（validator.ts）：20个测试
- 其他工具：error-mapper.test.ts、model-config.test.ts、share.test.ts
- UI组件：ai-analysis-tools.test.tsx、conversation-summary.test.tsx、mermaid-renderer.test.tsx

### 未覆盖关键模块

- diagram-validator.ts（图表校验逻辑，0%覆盖）
- export.ts（导出功能，0%覆盖）
- templates.ts（模板系统，0%覆盖）
- 4个API路由（chat、generate-prd、analyze、translate，0%覆盖）
- 10+个核心UI组件（smart-selector、generation-status-bar等，0%覆盖）
- 2个页面组件（chat页面、prd页面，0%覆盖）

### 测试增强目标

1. **核心功能完整性**：补充未覆盖模块的基础功能测试
2. **边界问题全覆盖**：识别并测试容易忽视的边界场景
3. **竞态条件防护**：测试并发、异步操作的状态一致性
4. **数据一致性保障**：测试跨模块的数据同步与恢复机制
5. **安全性验证**：测试SSRF防护、加密增强、输入校验等安全边界

## 二、测试覆盖策略

### 模块优先级划分

#### P0（高优先级）- 核心业务逻辑
- diagram-validator.ts（图表校验，涉及AI输出解析）
- export.ts（导出功能，文件生成边界）
- templates.ts（模板系统，业务配置）
- API路由的边界与安全测试（SSRF、竞态、错误处理）

#### P1（中优先级）- 关键交互组件
- smart-selector.tsx（受控/非受控模式切换）
- generation-status-bar.tsx（状态流转）
- generating-indicator.tsx（步骤进度）
- multi-language-prd.tsx（异步翻译竞态）

#### P2（低优先级）- 辅助功能
- 其他UI组件（theme-toggle、keyboard-shortcuts等）
- 页面级集成测试

### 边界问题分类

根据项目特性和历史经验，边界问题分为以下8类：

#### 1. 数据边界
- 空值/null/undefined处理
- 空字符串、空数组、空对象
- 极大/极小数值
- 超长字符串（如10000+字符的PRD内容）
- 特殊字符（Unicode、emoji、控制字符）

#### 2. 状态边界
- 组件初始化状态
- 状态转换的中间态（如生成中→取消→恢复）
- 状态回退（如已生成→重新生成）
- 状态不一致（如phase=generating但startTime为null）

#### 3. 时间边界
- 时间戳为0或负数
- 未来时间戳
- 时区差异
- 过期检测临界值（如正好30分钟前）
- 定时器竞态（如连续快速点击）

#### 4. 并发与竞态
- 多个请求并发发起
- 任务中断与新任务启动的竞争
- 页面刷新时的任务恢复竞态
- IndexedDB并发写入冲突
- React setState批处理竞态

#### 5. 网络边界
- 请求超时（API无响应）
- 流式响应中断（读取到一半断开）
- 响应格式异常（非JSON、畸形SSE）
- 重试次数耗尽
- SSRF攻击向量

#### 6. 存储边界
- IndexedDB quota超限
- localStorage存储失败
- 数据库事务失败
- 加密密钥丢失
- 数据迁移冲突

#### 7. 用户交互边界
- 快速连续点击按钮
- 输入超长文本
- 粘贴恶意内容（如XSS payload）
- 表单未填完就切换
- 浏览器前进/后退

#### 8. 业务逻辑边界
- 选择器选项为空
- 对话历史过短（无法生成PRD）
- 重复提问检测失效
- AI响应格式变化
- 图表语法禁用规则绕过

## 三、详细测试设计

### 模块一：diagram-validator.ts 边界测试

#### 核心功能测试
- extractDiagramJSON：提取各种格式的JSON（代码块、裸JSON、嵌入JSON）
- validateMermaidSyntax：校验图表语法
- validateDiagramResponse：端到端校验
- buildDiagramRetryPrompt：构建重试提示
- extractMermaidBlocksFromText：降级提取

#### 边界场景矩阵

| 测试场景 | 输入示例 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| 空输入 | "" | 返回valid=false，errors包含"未能提取JSON" | 数据边界 |
| 仅空白字符 | "   \n\t  " | 同上 | 数据边界 |
| 无效JSON格式 | "```json\n{ invalid }\n```" | 返回JSON解析失败错误 | 数据边界 |
| JSON缺少diagrams字段 | "```json\n{}\n```" | Zod校验失败，指出缺少diagrams | 业务边界 |
| diagrams为空数组 | "```json\n{\"diagrams\": []}\n```" | 校验失败，至少需要1个图表 | 业务边界 |
| diagrams超过5个 | 包含6个图表的JSON | 校验失败，最多5个图表 | 业务边界 |
| 图表title为空字符串 | title: "" | 校验失败，标题不能为空 | 数据边界 |
| 图表type非法 | type: "invalid-type" | 校验失败，type必须是枚举之一 | 业务边界 |
| 图表code长度<10 | code: "graph TB" | 校验失败，代码不能少于10字符 | 业务边界 |
| code包含禁止样式 | 包含style/classDef/fill | 语法校验失败，提示禁止样式 | 业务边界 |
| graph类型但无节点定义 | "graph TB\n" | 语法校验失败，未找到节点 | 业务边界 |
| erDiagram无实体 | "erDiagram\n" | 语法校验失败，未找到实体 | 业务边界 |
| 混合格式（JSON+文本） | "前言\n```json\n{...}\n```\n后续" | 成功提取JSON并校验 | 数据边界 |
| 多个代码块 | "```json\n{...}\n```\n```json\n{...}\n```" | 提取第一个代码块 | 数据边界 |
| 嵌套JSON | "{\"meta\": {\"diagrams\": [...]}}" | 提取嵌入的diagrams字段 | 数据边界 |
| 降级提取场景 | 包含多个```mermaid块但无JSON | 提取所有mermaid块并推断类型 | 业务边界 |
| mermaid块无标题 | "```mermaid\ngraph TB\n...```" | 自动生成"图表1"标题 | 数据边界 |
| 重试提示词生成 | 3个以上错误 | 只显示前3个错误 | 数据边界 |
| 转换为Markdown | ValidatedDiagramsResponse | 正确生成Markdown格式 | 功能验证 |

#### 安全边界测试
- 超大JSON输入（如100KB）：验证解析不崩溃
- 深度嵌套JSON（20层）：验证不触发堆栈溢出
- 恶意正则表达式（ReDoS）：验证提取逻辑耗时<1s
- Unicode零宽字符：验证不影响提取

### 模块二：export.ts 边界测试

#### 核心功能测试
- exportMarkdown：导出MD文件
- exportJSON：导出JSON文件
- exportPDF：浏览器打印
- exportWord：导出.doc文件
- copyToClipboard：剪贴板操作

#### 边界场景矩阵

| 测试场景 | 输入示例 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| 空内容导出 | content: "" | 生成空文件但不报错 | 数据边界 |
| 超长内容（10MB+） | 10MB Markdown文本 | 成功导出，无内存溢出 | 数据边界 |
| 特殊文件名 | "项目<>:?\|/\*.md" | 自动清理非法字符 | 数据边界 |
| 文件名包含路径 | "../../../etc/passwd" | 仅取basename | 安全边界 |
| Markdown转HTML边界 | 包含所有Markdown语法 | 正确转换所有语法 | 功能验证 |
| 嵌套列表处理 | 多层无序列表 | 正确包裹ul标签 | 业务边界 |
| 代码块内换行 | "```\nline1\nline2\n```" | 保留换行符 | 数据边界 |
| 链接包含特殊字符 | "[test](http://a.com?x=1&y=2)" | 正确转换为a标签 | 数据边界 |
| PDF打印窗口阻止 | window.open返回null | 抛出错误提示用户 | 用户交互边界 |
| PDF onload未触发 | 加载超时 | 500ms后自动触发打印 | 时间边界 |
| 剪贴板API不可用 | navigator.clipboard报错 | 降级为execCommand方案 | 兼容性边界 |
| execCommand失败 | document.execCommand返回false | 静默失败或提示用户 | 兼容性边界 |
| 并发导出请求 | 连续点击导出按钮 | 每次请求独立，不互相干扰 | 并发边界 |

#### 浏览器兼容性测试
- Safari clipboard权限：验证降级方案
- Firefox打印样式：验证CSS正确应用
- Chrome大文件下载：验证不触发OOM

### 模块三：templates.ts 边界测试

#### 核心功能测试
- getTemplateInitialInput：获取模板初始输入
- filterTemplatesByCategory：按分类过滤

#### 边界场景矩阵

| 测试场景 | 输入示例 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| 空模板prompts | template.prompts = [] | 返回空字符串 | 数据边界 |
| 单个prompt | prompts = ["单条需求"] | 返回该需求 | 功能验证 |
| 多个prompts | prompts = ["需求1", "需求2"] | 用换行符连接 | 功能验证 |
| prompts包含换行 | ["需求1\n需求2"] | 保留原有换行 | 数据边界 |
| 过滤all分类 | category = "all" | 返回所有模板 | 功能验证 |
| 过滤存在分类 | category = "saas" | 返回该分类模板 | 功能验证 |
| 过滤不存在分类 | category = "nonexistent" | 返回空数组 | 边界验证 |
| 模板ID冲突检测 | 两个模板ID相同 | 编译时类型检查或运行时去重 | 业务边界 |
| 模板分类枚举外值 | category = "unknown" as any | 类型系统拦截 | 类型边界 |

### 模块四：API路由 SSRF与安全边界测试

#### 4.1 validateCustomApiUrl 边界场景

| 测试场景 | 输入URL | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| 空URL | "" | valid=false, 提示URL为空 | 数据边界 |
| 无效URL格式 | "not-a-url" | valid=false, 提示格式错误 | 数据边界 |
| HTTP协议 | "http://api.openai.com" | valid=false, 只允许HTTPS | 安全边界 |
| FTP协议 | "ftp://example.com" | valid=false, 只允许HTTPS | 安全边界 |
| localhost | "https://localhost/api" | valid=false, 禁止内网 | 安全边界 |
| 127.0.0.1 | "https://127.0.0.1/api" | valid=false, 禁止内网 | 安全边界 |
| 10.x.x.x内网 | "https://10.0.0.1/api" | valid=false, 禁止内网 | 安全边界 |
| 172.16-31内网 | "https://172.16.0.1/api" | valid=false, 禁止内网 | 安全边界 |
| 192.168内网 | "https://192.168.1.1/api" | valid=false, 禁止内网 | 安全边界 |
| IPv6 localhost | "https://[::1]/api" | valid=false, 禁止内网 | 安全边界 |
| IPv6 link-local | "https://[fe80::1]/api" | valid=false, 禁止内网 | 安全边界 |
| 0.0.0.0 | "https://0.0.0.0/api" | valid=false, 禁止内网 | 安全边界 |
| 169.254 link-local | "https://169.254.1.1/api" | valid=false, 禁止内网 | 安全边界 |
| 白名单域名 | "https://api.openai.com/v1" | valid=true | 功能验证 |
| 白名单子域名 | "https://sub.api.openai.com/v1" | valid=true | 功能验证 |
| 非白名单域名 | "https://evil.com/api" | valid=false, 提示不在白名单 | 安全边界 |
| 域名大小写 | "https://API.OpenAI.COM" | valid=true（大小写不敏感） | 数据边界 |
| URL编码绕过 | "https://127%2e0%2e0%2e1/api" | valid=false（解析后检测） | 安全边界 |
| DNS rebinding | "https://malicious.com" | 白名单机制拦截 | 安全边界 |
| SSRF via redirect | 302跳转到内网 | 客户端fetch不跟随重定向 | 安全边界 |

#### 4.2 API请求边界测试（chat/generate-prd）

| 测试场景 | 输入 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| 请求体非JSON | 畸形文本 | 400错误，提示格式错误 | 数据边界 |
| 缺少apiKey | apiKey: undefined | 400错误，提示配置Key | 业务边界 |
| apiKey为空字符串 | apiKey: "" | 400错误，提示配置Key | 数据边界 |
| messages非数组 | messages: "string" | 400错误，提示格式错误 | 数据边界 |
| messages为空数组 | messages: [] | 允许（系统提示词补充） | 业务边界 |
| 未知model值 | model: "unknown" | 400错误，无效模型配置 | 业务边界 |
| custom模型缺URL | model: "custom", customApiUrl: undefined | 400错误，提示URL为空 | 业务边界 |
| custom模型缺modelName | model: "custom", customModelName: "" | 400错误，提示指定模型名 | 业务边界 |
| AI API返回非200 | 上游API 500错误 | 500错误，映射错误信息 | 网络边界 |
| AI API超时 | 30秒无响应 | 超时错误（依赖fetch超时配置） | 网络边界 |
| 流式响应中断 | 读取到一半连接断开 | 捕获错误，返回已聚合内容 | 网络边界 |
| SSE格式异常 | "data: invalid-json" | 忽略该行，继续解析 | 数据边界 |
| 校验失败后重试 | AI输出格式错误 | 自动重试最多2次 | 业务边界 |
| 重试耗尽 | 3次校验都失败 | 返回原始内容+错误信息 | 业务边界 |
| 并发请求 | 同时发起3个chat请求 | 互不干扰，各自返回 | 并发边界 |

### 模块五：UI组件边界测试

#### 5.1 SmartSelector 受控/非受控模式测试

| 测试场景 | 初始Props | 用户操作 | 预期状态 | 边界类型 |
|---------|---------|---------|---------|---------|
| 受控模式初始化 | value=[], onChange提供 | - | 显示已选状态提示 | 功能验证 |
| 非受控模式初始化 | onSubmit提供 | - | 显示提交按钮 | 功能验证 |
| 受控模式切换选项 | value=["opt1"] | 选择opt2 | onChange被调用，value由父组件更新 | 状态管理 |
| 非受控模式切换选项 | - | 选择opt2 | 内部状态更新，未触发onSubmit | 状态管理 |
| 非受控模式提交 | - | 点击提交按钮 | onSubmit被调用，传递选中值 | 功能验证 |
| required校验（text空） | required=true, type=text | 输入空格 | 提交按钮禁用 | 业务边界 |
| required校验（选项空） | required=true, type=checkbox | 未选择任何项 | 提交按钮禁用 | 业务边界 |
| disabled状态 | disabled=true | 尝试点击选项 | 所有交互禁用 | 用户交互边界 |
| 选项为空数组 | options=[] | - | 不渲染选项，但不报错 | 数据边界 |
| 快速切换选项 | - | 连续快速点击 | 状态正确更新，无竞态 | 并发边界 |
| checkbox全选后取消 | - | 全选后逐个取消 | 数组正确移除元素 | 状态管理 |
| dropdown空值 | value=undefined | - | 显示placeholder | 数据边界 |
| text类型粘贴长文本 | - | 粘贴10000字符 | 正常输入，无截断 | 数据边界 |
| 建议选项点击 | type=text, options提供 | 点击建议选项 | 自动填充到输入框 | 功能验证 |
| 模式动态切换 | 受控→非受控 | Props变更 | 组件重新初始化 | 状态管理 |

#### 5.2 GenerationStatusBar 状态流转测试

| 测试场景 | 初始phase | 状态变更 | 预期UI | 边界类型 |
|---------|---------|---------|---------|---------|
| idle状态 | idle | - | 不显示或显示默认UI | 功能验证 |
| generating状态 | generating | - | 显示进度条+取消按钮 | 功能验证 |
| completed状态 | completed | - | 显示成功图标 | 功能验证 |
| error状态 | error | - | 显示错误信息+重试按钮 | 功能验证 |
| 状态快速切换 | idle→generating→completed | 1秒内切换 | UI正确响应，无闪烁 | 并发边界 |
| 取消后重新生成 | generating→cancelled→generating | - | 清除旧状态，重新计时 | 状态管理 |
| elapsedTime溢出 | startTime为1小时前 | - | 显示超时提示 | 时间边界 |
| progress超过100 | progress=150 | - | 显示100%或自动修正 | 数据边界 |
| progress为负数 | progress=-10 | - | 显示0%或拒绝渲染 | 数据边界 |
| 错误信息超长 | error长度>1000 | - | 截断或滚动显示 | 数据边界 |

#### 5.3 MultiLanguagePRD 异步翻译竞态测试

| 测试场景 | 初始状态 | 用户操作 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|---------|
| 首次点击翻译 | 无缓存 | 点击English | 发起翻译请求，显示loading | 功能验证 |
| 缓存命中 | 有缓存 | 点击已翻译语言 | 立即显示缓存内容 | 功能验证 |
| 快速切换语言 | - | 1秒内切换3次 | 中断旧请求，只保留最后一次 | 并发边界 |
| 翻译中切回原文 | 正在翻译 | 点击中文 | 取消请求，显示原文 | 状态管理 |
| 翻译失败 | - | API返回错误 | Toast提示，保持原语言 | 网络边界 |
| 并发翻译多语言 | - | 同时点击2种语言 | 串行处理或拒绝第二次 | 并发边界 |
| 刷新页面恢复 | 翻译到一半 | 刷新浏览器 | 恢复到中文，缓存保留 | 状态恢复 |
| 缓存过期 | 30分钟前缓存 | - | 重新翻译 | 时间边界 |
| PRD内容变更 | 有缓存 | PRD重新生成 | 缓存失效，重新翻译 | 业务边界 |
| 内容hash碰撞 | - | 两个不同内容但hash相同 | 极低概率，可忽略或使用更强hash | 安全边界 |

### 模块六：状态管理竞态与一致性测试

#### 6.1 PRD生成任务竞态场景

| 测试场景 | 初始状态 | 触发事件 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|---------|
| 正常生成完成 | idle | 点击生成 | 状态流转idle→generating→completed | 功能验证 |
| 生成中取消 | generating | 点击取消 | abortController.abort()，状态→cancelled | 功能验证 |
| 生成中刷新页面 | generating | 刷新 | 恢复任务，提示"继续/重试" | 状态恢复 |
| 生成中关闭标签页 | generating | 关闭 | 任务持久化，下次打开恢复 | 状态恢复 |
| URL携带?generate=true | idle | 页面加载 | 立即启动生成，设置generationStartedRef | 竞态防护 |
| 恢复检测竞态 | - | URL生成+DB恢复同时触发 | generationStartedRef阻止恢复覆盖 | 竞态防护 |
| 内存任务vs持久化任务 | - | 存在内存活跃任务 | 不恢复持久化任务，避免误判 | 竞态防护 |
| startTime时间戳比较 | - | 内存任务更新，DB任务更旧 | 保留内存任务，忽略旧任务 | 竞态防护 |
| prdContent与error不一致 | - | error存在但content有值 | 恢复时校验，确保状态一致 | 数据一致性 |
| 重试失败任务 | error | 点击重试 | 清除error，重置状态，重新生成 | 功能验证 |
| 连续点击生成按钮 | idle | 1秒内点击3次 | 防抖或拒绝后续点击 | 并发边界 |
| 多项目并发生成 | - | 两个项目同时生成 | 任务隔离，互不干扰 | 并发边界 |
| chunks数组竞态 | - | 快速追加大量chunk | 批处理更新，避免渲染抖动 | 性能边界 |

#### 6.2 聊天状态管理竞态场景

| 测试场景 | 初始状态 | 触发事件 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|---------|
| 正常对话流程 | idle | 发送消息 | 添加用户消息→AI回复→更新selectors | 功能验证 |
| 对话中取消 | generating | 点击取消 | abortController.abort()，停止流式接收 | 功能验证 |
| 快速连续发送 | idle | 1秒内发2条消息 | 队列处理或禁用发送按钮 | 并发边界 |
| 选择器未填完就切换 | - | 切换到其他项目 | 草稿自动保存 | 状态持久化 |
| 草稿保存竞态 | - | 连续快速输入 | 防抖保存，避免频繁写DB | 并发边界 |
| 草稿恢复时机 | - | 页面加载 | 在组件挂载后恢复草稿 | 状态恢复 |
| 草稿过期清理 | 30分钟前草稿 | 清理任务 | 自动删除过期草稿 | 时间边界 |
| 多选择器统一提交 | - | 3个选择器批量选择 | selectionsMap聚合后一次提交 | 状态管理 |
| 项目间状态隔离 | - | 切换项目 | 不同项目的生成状态互不影响 | 状态隔离 |

#### 6.3 IndexedDB并发与事务边界

| 测试场景 | 操作 | 并发条件 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|---------|
| 并发写入同一记录 | projectsDB.update() | 两个标签页同时更新 | 最后写入生效，无数据丢失 | 并发边界 |
| 读写竞态 | getById()+update() | 读取时另一线程写入 | 读取到旧数据或新数据，不崩溃 | 并发边界 |
| 事务冲突 | db.transaction() | 多个事务操作同一表 | 串行执行或等待 | 并发边界 |
| quota超限 | save大量数据 | 存储空间不足 | 捕获QuotaExceededError，提示用户 | 存储边界 |
| 数据库版本升级 | 代码升级DB schema | 旧数据迁移 | 自动迁移或提示用户刷新 | 版本边界 |
| 加密密钥变更 | 用户修改密钥 | 旧数据加密格式 | 提示重新输入或数据丢失警告 | 安全边界 |
| cleanup时间戳边界 | 清理30分钟前数据 | 边界记录（正好30分钟） | 包含或不包含，行为一致 | 时间边界 |

### 模块七：安全边界增强测试

#### 7.1 加密系统V2增强测试

| 测试场景 | 输入 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| HMAC完整性验证 | 篡改密文 | 解密失败，返回原文 | 安全边界 |
| 重放攻击防护 | 旧版加密格式 | 仍可解密，向后兼容 | 兼容性 |
| 密钥强度检测 | 弱密钥（<8字符） | 加密时警告或拒绝 | 安全边界 |
| 密钥包含特殊字符 | "key@#$%" | 正常加密，特殊字符转义 | 数据边界 |
| 加密空字符串 | "" | 返回空字符串 | 数据边界 |
| 加密null/undefined | null | 返回空字符串，不崩溃 | 数据边界 |
| 解密畸形密文 | "random-string" | 返回原文（向后兼容未加密数据） | 兼容性 |
| 解密截断密文 | 密文缺少后半部分 | 解密失败，返回原文 | 数据边界 |
| isEncrypted边界 | "U2FsdGVkX1" | 识别为加密 | 功能验证 |
| isEncrypted边界 | "PRD_v2_" | 识别为加密 | 功能验证 |

#### 7.2 输入校验XSS防护测试

| 测试场景 | 输入 | 预期行为 | 边界类型 |
|---------|---------|---------|---------|
| script标签注入 | "<script>alert(1)</script>" | 自动转义或过滤 | 安全边界 |
| img onerror注入 | "<img src=x onerror=alert(1)>" | 转义或移除事件处理器 | 安全边界 |
| javascript:协议 | "[link](javascript:alert(1))" | Markdown渲染器过滤 | 安全边界 |
| data:协议 | "[link](data:text/html,...)" | 过滤或限制 | 安全边界 |
| HTML实体编码绕过 | "&lt;script&gt;" | 二次解码防护 | 安全边界 |
| Unicode编码绕过 | "\u003cscript\u003e" | 解码后检测 | 安全边界 |
| SQL注入（虽然无SQL） | "'; DROP TABLE--" | IndexedDB不受影响 | 安全边界 |
| NoSQL注入 | "{$gt: ''}" | Dexie查询参数化 | 安全边界 |

## 四、测试实现规范

### 测试文件组织结构

#### 新增测试文件清单

### 测试辅助工具扩展

#### 新增Factory函数

- createTestDiagram()：创建测试图表数据
- createTestExportOptions()：创建导出配置
- createTestTemplate()：创建模板对象
- createInvalidJSON()：生成各种畸形JSON
- createSSRFPayload()：生成SSRF测试用例

#### 新增Helper函数

- mockFetch()：模拟fetch请求
- mockIndexedDB()：模拟DB操作
- mockClipboardAPI()：模拟剪贴板
- mockWindowOpen()：模拟window.open
- waitForAsync()：等待异步操作完成
- simulateNetworkDelay()：模拟网络延迟
- simulateNetworkError()：模拟网络错误

### 测试覆盖率目标

#### 阶段性目标

- 第一阶段（P0模块）：覆盖率提升至40%
- 第二阶段（P1模块）：覆盖率提升至60%
- 第三阶段（P2模块）：覆盖率提升至80%

#### 各模块覆盖率要求

| 模块类型 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|---------|---------|-----------|-----------|
| 核心业务逻辑 | ≥90% | ≥85% | ≥90% |
| 工具函数 | ≥95% | ≥90% | ≥95% |
| UI组件 | ≥80% | ≥75% | ≥80% |
| API路由 | ≥85% | ≥80% | ≥85% |
| 页面组件 | ≥70% | ≥65% | ≥70% |

### 测试命名规范

#### 测试套件命名
- 模块名 - 功能描述
- 示例："diagram-validator.ts - Mermaid语法校验"

#### 测试用例命名
- "应该 + 预期行为 + 边界条件"
- 示例："应该在图表code少于10字符时校验失败"
- 示例："应该拦截127.0.0.1内网地址的SSRF攻击"

#### 边界测试标注
- 测试用例中注释标注边界类型
- 示例：`// 数据边界：空字符串`
- 示例：`// 安全边界：SSRF防护`

### Mock与Stub策略

#### API请求Mock

- 使用MSW (Mock Service Worker) 拦截网络请求
- 模拟正常响应、错误响应、超时、流式中断等场景
- 每个测试独立配置Mock，避免状态泄漏

#### IndexedDB Mock

- 使用fake-indexeddb模拟数据库操作
- 每个测试前清空数据库
- 测试并发时使用独立数据库实例

#### 浏览器API Mock

- navigator.clipboard：提供fallback测试
- window.open：模拟返回null场景
- fetch：模拟超时、网络错误
- ReadableStream：模拟流中断

#### 时间Mock

- 使用jest.useFakeTimers()控制时间流逝
- 测试setTimeout/setInterval逻辑
- 测试时间戳过期判断

## 五、测试执行与持续集成

### 本地测试流程

#### 开发时测试

#### 提交前测试

#### 覆盖率报告

### CI/CD集成

#### GitHub Actions配置

#### 覆盖率徽章

#### 测试失败通知

### 测试维护策略

#### 定期Review

- 每月检查测试覆盖率变化
- 识别新增代码未覆盖部分
- 更新边界场景清单

#### 测试重构

- 消除重复测试代码
- 提取公共测试逻辑
- 优化测试执行速度

#### 失败测试处理

- 失败测试必须在24小时内修复或标记skip
- 不允许提交已知失败的测试到main分支
- 失败原因必须记录issue追踪

## 六、风险与缓解措施

### 测试覆盖风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 边界场景遗漏 | 生产环境bug | 定期Review，参考真实issue补充测试 |
| 测试维护成本高 | 开发效率下降 | 提取公共逻辑，自动化测试生成 |
| Mock与真实行为差异 | 测试通过但生产失败 | 增加集成测试，定期手工验证 |
| 测试执行时间过长 | CI/CD流水线慢 | 并行测试，缓存依赖，优化慢测试 |
| 竞态测试不稳定 | Flaky tests | 增加重试机制，使用确定性时间控制 |

### 兼容性风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 浏览器API差异 | 测试环境通过但浏览器失败 | 使用真实浏览器E2E测试补充 |
| Node.js版本差异 | CI环境与本地不一致 | 固定Node版本，使用.nvmrc |
| 依赖库升级 | 测试失败 | 锁定依赖版本，定期升级并测试 |

### 安全测试风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SSRF测试不充分 | 安全漏洞 | 参考OWASP清单，增加Fuzzing测试 |
| XSS测试覆盖不全 | 注入攻击 | 使用自动化XSS扫描工具 |
| 加密测试不够严格 | 数据泄露 | 参考NIST标准，第三方安全审计 |

## 七、成功标准

### 量化指标

- 整体代码覆盖率达到70%以上
- P0模块覆盖率达到90%以上
- 新增测试用例数量≥150个
- 所有边界场景清单100%覆盖

### 质量指标

- 所有测试稳定运行，无Flaky tests
- 测试执行时间<5分钟（本地）
- CI测试执行时间<10分钟
- 测试代码可读性评分≥8/10（Code Review评分）

### 业务指标

- 生产环境边界bug减少80%
- 安全漏洞减少100%（0个已知漏洞）
- 代码重构信心提升（可量化为重构频率）
