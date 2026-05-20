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

> **Phase 1 数据模型中心 + MVP（进行中）** — Phase 0 设计规格 87% 完成，M1 PRD 编写中。

详细路线图见 `docs/00-project/roadmap/README.md`。

## 技术栈

- **B/S 架构**，Node.js
- 后端: Fastify + PostgreSQL + Drizzle ORM + TypeBox + Ajv
- 前端: React + Vite + TypeScript + shadcn/ui + React Router v6 + ReactFlow
- 项目结构: Monorepo (pnpm workspaces + Turborepo)
- 原型产物格式：**HTML + CSS + JS**（双轨制：视觉层 + 语义层分离）

## 目录结构

```
├── CLAUDE.md                  # Claude Code 项目指引
├── README.md                  # 本文件
├── docs/                      # 文档（持久化存储）
│   ├── 00-project/             # 项目元数据
│   │   └── roadmap/           # 建设路线图（主 README + phase0~5 明细）
│   ├── 01-design-idea/        # 设计构想与讨论记录
│   ├── 02-domain-model/       # 领域模型设计产物
│   ├── 03-prd/                # 产品需求规格 + PRD 编写规范
│   ├── 04-tech-design/        # 技术方案设计
│   ├── 05-data-design/        # 数据库 DDL + 前端数据方案
│   ├── 06-test-design/        # 测试方案（待填充）
│   ├── 07-deploy-design/      # 部署方案（待填充）
│   ├── 99-archived/           # 已归档历史文件
│   └── 20-analyze-report/     # 分析报告
├── packages/                  # 代码（Monorepo: api / web / shared / validation-schemas / e2e）
└── logs-important/            # 重要对话记录（按日期分文件）
```
