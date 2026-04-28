# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-prototype-manager** — AI 时代的软件原型设计工具，核心定位：**面向 AI 的原型系统**。

与传统原型工具（Figma/Sketch 等）聚焦"给人看的高保真视觉"不同，本项目聚焦于 **"给 AI 用的结构化语义"** —— 确保原型中包含的业务逻辑、交互逻辑、数据关系等关键信息能够完整传递给下游 Coding Agent，而非在视觉还原过程中丢失。

## 三大核心支柱

### 1. Agentic 原型构建
产品经理与 AI 对话协作完成原型设计：PM 输出决策和思考，AI 动笔执行。支持从粗粒度（"我要一个电商后台"→生成完整原型）到细粒度（组件级对话迭代）的全流程。人类可实时观察 AI 的产出进程和结果。

### 2. Agentic 原型数据输出
面向 Coding AI 提供易于提取、理解的原型设计结构化信息输出，确保原型产物 100% 可被 Coding Agent 消费以指导编码工作。

### 3. 结构化交互原型数据
超越布局和展示层面的"高保真"，最大化抽象和提取原型中的：
1. **交互逻辑**（最高优先级）— 点击、跳转、状态变化、条件分支流程
2. **数据模型关系** — UI 元素绑定字段、数据流向
3. **业务规则** — 校验逻辑、权限控制、计算公式
4. **组件语义** — 元素的业务意图（是"提交"还是"取消"）

## 协作模式

```
PM（产品经理）
  │  对话 + 决策
  ▼
Design AI（本系统集成 LLM 能力）
  │  动手执行：创建页面、添加组件、定义交互
  ▼
原型产物（HTML + 结构化语义数据）
  │  MCP 只读接口
  ▼
Coding AI（下游，如 Claude Code / Cursor / Devin）
  │  读取结构化信息 → 理解项目逻辑 → 编码实现
  ▼
可用软件系统
```

## 技术架构决策

### 技术栈
- **B/S 架构**，Node.js 技术栈
- 原型产物格式：**HTML + CSS + JS**
- 数据库存储生成的 HTML 及关联的语义元数据

### 原型产物数据模型
采用 **视觉层与语义层分离** 的双轨制：

| 层 | 格式 | 职责 |
|---|---|---|
| 视觉层 | HTML + CSS | 页面布局、样式呈现 |
| 语义层 | JS（内聚引用） | 交互逻辑、数据绑定、业务规则、组件语义 |

- HTML 通过 `<script>` 标签引用语义层 JS 文件
- 两者在数据库中关联存储，导出时保持引用关系

### MCP 接口设计（双向）

| 方向 | 角色 | 性质 |
|---|---|---|
| **上游**（创建时） | Design AI 通过 MCP 操作原型 | 读写接口 — CRUD 式或意图式（待设计方案时确定） |
| **下游**（编码时） Coding AI 通过 MCP 读取原型 | **只读查询** — 获取项目的完整页面结构和交互逻辑 |

> 上游 MCP 接口的具体形态（CRUD vs 意图式）尚未确定，需要在系统设计阶段讨论决定。

## 远程仓库

- **GitHub**: https://github.com/kai-cui1/ai-prototype-manager

## 项目目录规范

```
ai-prototype-manager/
├── CLAUDE.md                  # Claude Code 项目指引（本文件）
├── docs/                      # 文档（持久化存储）
│   ├── 01-design-idea/        # 产品设计构想与讨论记录
│   │   └── 01-design-idea.md  # 所有产品设计决策的单一来源
│   ├── 02-roadmap.md          # 建设路线图与进度追踪
│   ├── 02-domain-model/       # 领域模型（元模型）
│   ├── 04-tech-design/        # 技术方案设计 ⭐ Phase 1 起新增
│   │   └── <topic>-design.md  # 按技术主题分文件（如 validation-design.md）
│   └── (其他设计文档)
├── logs-important/            # 重要对话记录（按日期分文件）
│   └── YYYY-MM-DD-conversation.md
└── (Phase 1 起的代码目录，待初始化)
```

### 文档规范

**所有重要设计讨论必须实时记录到 `docs/` 目录下。**

规则：
- **产品设计决策** → `docs/01-design-idea/` 或对应编号文档
- **技术方案设计** → `docs/04-tech-design/`（**Phase 1 起**：含选型分析、架构决策、模块设计等）
- 不要只在对话中讨论而不落盘 —— 对话是临时的，文档是持久的
- 技术方案文档命名格式：`<topic>-design.md`（如 `validation-design.md`）

### 对话归档规范

**每次重要对话会话结束时，将完整对话内容保存到 `logs-important/` 目录。**

规则：
- 按日期分文件：`YYYY-MM-DD-conversation.md`
- 原封不动保存 PM 与 AI 的所有实质性对话内容（**含 AskUserQuestion 的选择性回复内容和用户 notes**）
- 从 Claude Code 会话 JSONL 日志中自动提取生成

## 当前阶段

**Phase 1：架构冻结 + MVP（规划中）** — Phase 0 设计规格 100% 完成，进入技术方案设计与实现规划。
详细路线图见 `docs/02-roadmap.md`。

### 已确定的技术栈

| 决策 | 选择 |
|------|------|
| 后端框架 | Fastify |
| 数据库 | PostgreSQL |
| ORM | Drizzle |
| 校验方案 | TypeBox + Ajv |
| 项目结构 | Monorepo (pnpm workspaces + Turborepo) |
| 前端 | React + Vite + TypeScript |
