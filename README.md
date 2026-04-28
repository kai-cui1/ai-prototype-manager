# ai-prototype-manager

AI 时代的软件产品定义与生命周期管理平台 —— 以结构化语义原型为核心，连接产品定义、研发实现与测试验证。

## 核心定位

传统原型工具（Figma/Sketch 等）聚焦于"给人看的高保真视觉"。本项目聚焦于 **"给 AI 用的结构化语义"** —— 确保原型中包含的业务逻辑、交互逻辑、数据关系等关键信息能够完整传递给下游 Coding Agent。

**本项目是「产品定义的单一事实来源（Single Source of Truth）」**，连接 PM → 研发 → 测试 全链路。

## 六阶段工作流

```
A. 理解业务（领域建模）→ B. 定义系统运转（业务流程设计）→ C. 定义人机接口（页面/组件）
→ D. 视觉与验证（外部设计稿集成）→ E. 与研发集成（MCP 输出规格）→ F. 与测试集成（测试用例生成）
```

## 当前状态

> **概念设计阶段（阶段一进行中，77% 完成）**

已完成的设计文档：

| 文档 | 内容 | 状态 |
|------|------|------|
| `docs/01-design-idea/` | 项目定位、五大支柱、协作模式、要素清单 23 项 | ✅ |
| `docs/02-domain-model/` | 系统领域模型 / 元模型（5 大域 ~19 实体） | ✅ |
| `docs/03-semantic-layer-schema.md` | 语义层 Schema 骨架设计 | ✅ |
| `docs/04-app-shared-resources.md` | App 级共享资源体系（26 种字段类型、GlobalActions、Hook 模型等） | ✅ |
| `docs/05-object-lifecycle.md` | 对象生命周期交互范式（钩子/事件/action 体系） | ✅ |
| `docs/06-external-design-integration.md` | 外部设计稿集成与布局映射 | ✅ |
| `docs/07-component-library.md` | 标准组件库（~52 组件 / 6 分类 / 三层继承） | ✅ |
| `docs/08-business-process.md` | 业务流程系统 v1.1（全局节点池、decisions 对称模型、纯管道数据流、29 项决策） | ✅ |
| `docs/workflow.md` | A→F 六阶段完整工作流定义 | 📝 待补充细节 |

待完成：subProcess 设计、循环约束规则、MCP 接口形态、PM-AI 协作界面、LLM 集成方案、版本管理策略

## 技术栈

- **B/S 架构**，Node.js
- 原型产物格式：**HTML + CSS + JS**（双轨制：视觉层 + 语义层分离）
- MCP 双向接口：上游（Design AI 读写）+ 下游（Coding AI 只读）

## 目录结构

```
├── CLAUDE.md              # Claude Code 项目指引
├── README.md              # 本文件
├── docs/                  # 设计文档
│   ├── 01-design-idea/    # 设计构想与讨论记录
│   ├── 02-roadmap.md      # 建设路线图
│   └── 03~08/             # 各专项设计文档
└── logs-important/        # 讨论日志（按日期归档）
```
