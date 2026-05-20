# 2026-05-06 对话记录

> **主题**: M1 Step 5 编码前准备 — 编码实施规范制定 + 工作流讨论
> **会话类型**: 重要对话（编码规范设计，含大量决策和产出）

---

## 会话概要

| 项 | 内容 |
|----|------|
| 前置状态 | M1 模块 Step 0~4 全部完成（PRD ✅ + 技术方案 ✅ + 测试用例 315 个 ✅），准备进入 Step 5 |
| 本轮完成 | 编码实施规范 v1.1 制定（总纲）+ Roadmap 更新 + CLAUDE.md 同步 |
| 新增产出 | `docs/04-tech-design/coding-convention.md`（~420 行） |
| 待办产出 | `coding-convention-backend.md` + `coding-convention-frontend.md`（明天继续） |

---

## 讨论过程

### 第一阶段：输入物盘点

在讨论编码规范前，先对当前代码骨架做了全面盘点：

**已有基础**：
- Fastify app 骨架（CORS / 错误处理 / health check / 6 个 TODO 路由注册点）
- Drizzle DB 连接（但 schema.ts 只有 4/19 表：projects + domain model 表）
- 共享类型定义完整（7 个领域类型文件，全部模块覆盖）
- ApiClient 完整实现（get/post/put/delete + 错误处理）
- Web Layout + Router 配置就绪
- 所有页面为 stub（"将在 M1 实现"）

**缺失项（M1 编码硬前置）**：
- Drizzle Schema 缺 5 表：companies / departments / roles / external_entities / menus
- TypeBox 校验 Schema 仅 project 初版且与 PRD 不一致（字段约束不匹配）
- 无 services/ 目录、无 routes/ 代码、无 hooks/
- shadcn/ui 业务组件未安装

### 第二阶段：编码工作流决策（4 项）

通过 AskUserQuestion 确认了以下决策：

| 决策点 | 用户选择 |
|--------|---------|
| **实施粒度** | 按功能点 F-Mx-NN（每个功能点独立交付验证） |
| **测试时机** | TDD：每写完一个功能点代码立即写对应测试 |
| **确认环节** | 每个 F-Mx-NN 完成后 Code Review |
| **UI 组件安装** | 按需添加（用到才 npx shadcn add） |

### 第三阶段：编码规范 v1.0 初版编写

编写了 `docs/03-prd/coding-convention.md` v1.0，包含：
- §0 核心原则（5 条）
- §1 编码前准备（前置条件检查 + P1-P4 硬前置 + 准备就绪确认）
- §2 输入物阅读顺序（5 步 + 角色定位表）
- §3 单功能点编码循环（C1 Service → C2 Route → C3 前端 → C4 TDD → C5 Review）
- §4 确认环节总览（检查点矩阵 + 里程碑划分）
- §5 异常处理与回滚策略（4 种场景）
- §6 产出物清单

### 第四阶段：用户反馈 — 三项改进要求

用户提出三项重要修改要求：

1. **引用前后端独立子文件**：编码规范应引用 `coding-convention-backend.md` 和 `coding-convention-frontend.md`（待编写），共性抽取到总纲，M1 特有内容不放
2. **完善 Code Review 和注释要求**：需要更详细的审查标准，R1-R5 注释规则要强制化
3. **文件位置改为 docs/04-tech-design/**：与技术方案文档放在一起更合理

### 第五阶段：v1.0 → v1.1 重写

基于反馈重写了编码规范，主要增强：

#### A. 文件迁移
- 旧位置：`docs/03-prd/coding-convention.md` → 已删除
- 新位置：`docs/04-tech-design/coding-convention.md`
- CLAUDE.md 同步更新（目录树 + 引用路径 + 编码规范章节）

#### B. 新增前后端子文件引用（§7 + §8）

**§7 后端编码细则（概要）**：
- 分层架构目录树（app → services → routes → models → __tests__）
- 核心约定摘要表（文件命名/函数命名/命名空间/错误抛出/事务/分页/snake_case↔camelCase）
- 详细内容指向 `coding-convention-backend.md`（待编写）

**§8 前端编码细则（概要）**：
- 目录结构（pages/components/hooks/lib/types/ui）
- 核心约定摘要表（文件命名/组件拆分/Hook封装/状态管理/Loading态/样式/UI组件安装）
- 详细内容指向 `coding-convention-frontend.md`（待编写）

#### C. Code Review 五维审查模型（§4，全新扩展）

从原来的简单表格扩展为完整的五维审查体系：

| 维度 | 名称 | 审查重点 |
|------|------|---------|
| 维度一 | 需求一致性 | PRD 功能/字段/规则/AC 是否完整实现 |
| 维度二 | 规则覆盖完整性 | B-rule/G-rule 可追溯的代码映射 |
| 维度三 | 测试质量 | TC 实现率/断言充分性/异常覆盖/双层一致性 |
| 维度四 | 代码质量 | **R1-R5 强制检查清单** + 命名/分层/类型安全/粒度 |
| 维度五 | 安全性 | SQL注入/XSS/权限/信息泄露 |

新增内容：
- 每个维度的检查项 + 通过标准 + 不通过示例
- **R1-R5 注释专项检查清单**（5 规则 × 检查内容 × 典型违规）
- R1-R5 违规升级规则（单处=Important，批量>3=Critical）
- 问题分级表（Critical/Important/Minor/Suggestion）含定义+示例+处理方式
- **Review 通过标准 checklist**（Critical=0, Important=0, R1-R5≤1, B-rule≥95%）

#### D. R1-R5 注释强制化

多处强化注释要求：
- 核心原则第 6 条：「无注释的提交不予通过 Review」
- C1/C3 编码要点中标注「注释为最高优先级」
- 维度四含完整五规则检查清单

---

## 决策记录

| # | 决策 | 理由 | 影响范围 |
|---|------|------|---------|
| D1 | 实施粒度 = 功能点 F-Mx-NN | 每个功能点可独立验证，问题不过夜 | 所有模块 Step 5 |
| D2 | 测试时机 = TDD（功能点完成后立即测） | 缺陷早发现早修复，回滚成本低 | 所有模块 Step 5~6 |
| D3 | 确认环节 = 每 F-Mx-NN 完成 Code Review | 最细粒度的质量控制 | 所有模块 Step 5 |
| D4 | UI 组件 = 按需安装 | 保持 package 精简，减少不必要的依赖 | 前端开发 |
| D5 | Code Review = AI Agent 自动执行 | 效率最高，标准化审查流程 | 所有模块 Step 5 |
| D6 | 编码规范文件位置 = docs/04-tech-design/ | 与技术方案文档放在一起，逻辑归属清晰 | 文档组织 |
| D7 | 前后端细则独立子文件 | 总纲保持通用性，细则可按需迭代深化 | 文档组织 |
| D8 | R1-R5 强制化 + Review 一票否决 | 注释是代码可读性保障，不是可选装饰 | 代码质量 |

---

## Roadmap 更新

### phase1.md 变更
- 1-A 新增 3 项：1.A.10 编码规范 v1.1 ✅ / 1.A.11 后端细则 ⏳ / 1.A.12 前端细则 ⏳
- 1-B 标题更新：Step 5 准备中（编码规范✅ 细则⏳）
- SDLC 矩阵 Step 5 行：⏳ 待开始 → 🔄 准备中

### README.md 变更
- Phase 1-A：9/9=100% → 12/10/2=~83%
- Phase 1-B：4/0/4=50% → 4/1/3=~56%
- Phase 1 合计：49/21/0/28=~51% → 52/22/1/29=~43%
- 版本历史新增 V3.3
- 整体视图更新 M1 状态描述

---

## 下一步计划

明天继续讨论并编写：
1. **`docs/04-tech-design/coding-convention-backend.md`** — 后端编码细则
   - 完整的分层架构约定
   - 命名规范（文件/函数/变量/常量/类型）
   - Service 层模式库（CRUD 模板/查询构建/事务处理/错误码使用）
   - Route 层模式库（路由注册/参数提取/校验链/响应组装）
   - Model 层 Drizzle 使用规范
   - 公共工具函数设计

2. **`docs/04-tech-design/coding-convention-frontend.md`** — 前端编码细则
   - 完整的目录结构与组件组织
   - 组件设计原则与拆分标准
   - Hook 设计模式（数据获取/ mutation / 联动）
   - 状态管理策略
   - 样式方案与 Tailwind 使用规范
   - shadcn/ui 使用指南与变体定制
   - API 调用与错误处理模式

编写完两个细则后 → 进入 P1（补齐 Drizzle 4 表 Schema）+ P2（补齐 TypeBox 校验 Schema）→ 你确认 → 开始 F-M1-01 编码。
