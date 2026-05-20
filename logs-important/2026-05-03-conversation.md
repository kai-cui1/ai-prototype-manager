# 2026-05-03 对话日志

## 主题
1. M1 PRD（prd-2.md）审核：Role 独立性设计 + 部门 parent_id 矛盾修复 + 领域模型补全 + 角色入口提升

## 对话概述

### 起点
用户继续审核 `project-management-prd-2.md`（§4.5~§6），发现 2 个问题需要深入讨论。

### 问题 1：Role 的独立性（核心设计变更）

**用户指出**：删除公司时连带删除 Role 不合理。2C 项目（如社交 App、电商 C 端）没有公司/部门概念，但业务流程中仍需角色定义。Role 应该可以单独存在，组织架构只是可选的修饰。

**讨论过程**：
1. 通过 brainstorming skill 进行结构化讨论
2. 确认了 4 项关键决策：
   - **归属模式**：department_id 改为 nullable（可选挂载）
   - **删除行为**：软解绑（SET NULL），不删除 Role 本身
   - **UI 导航**：独立入口 + 组织快捷筛选
   - **name 唯一性**：project_id 级全局唯一
3. 设计决策写入 `docs/01-design-idea/role-independence-design.md`
4. 全面修改 PRD §4.6/§4.7/§4.8 + §5/§6 联动更新

### 问题 2：部门 parent_id 与 DB Schema 矛盾

**用户指出**：DB Schema 有 `parent_id` 自引用+索引+注释"支持多级部门"，但 PRD 写了"不支持嵌套层级，是扁平结构"。这是明确的 PRD 与已审核 Schema 不一致。

**处理**：对齐 Schema 为树形组件，新增 parent_id 相关规则（B-M1-48b 创建校验、B-M1-52b 循环引用检测），补充领域模型信息。

### 领域模型补全

用户要求检查 domain-model.md 缺失对象。发现：
- **Company** — 完全缺失（DB 有、PRD 有、领域模型没有）
- **Department** — 完全缺失（同上）
- **ExternalEntity** — 完全缺失（同上）
- **Role** — 存在但定义过时（缺 department_id 可选挂载等字段）

执行 domain-model.md v1.0 → v1.1 更新（§2.3~2.6 新增 3 实体 + Role 迁移增强 + ER 图/映射表更新）。

### prd-2.md 全面审核（第 2 轮）

逐节审核 §4.5~§6，发现并修复 7 个问题：

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| 1 | 删除弹窗文案未对齐软解绑 | §4.6 L259 | ✅ |
| 2 | 领域模型对照说明过时 | §4.7 L394 | ✅ |
| 3 | 删除弹窗文案风格 minor | §4.7 L497 | ✅ |
| 5 | 领域模型引用位置过时 | §4.8 L639 | ✅ |
| 6 | 部门筛选器数据路径歧义 | §4.8.6 AI提示 | ✅ |
| 7 | 校验汇总省略漏 INVALID_ENUM | §4.9 L1025 | ✅ |

### 角色入口提升（架构决策）

**用户决策**：Role 是业务流程的核心参与者（process_nodes.holder），不应嵌套在组织架构下。组织架构仅是对角色的可选修饰。

**变更**：角色从「组织架构→角色子 Tab」提升为**项目详情页一级 Tab**（与"概要""组织架构"平级）。影响 §4.8 全章节 + §4.6/§4.7/§4.9 联动描述 + AC-M1-U06。

## 产出物清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `docs/01-design-idea/role-independence-design.md` | **新建** | Role 独立性 4 项设计决策 |
| `docs/02-domain-model/domain-model.md` | **修改** | v1.0→v1.1: 新增 Company/Department/ExternalEntity + Role 迁移增强 |
| `docs/03-prd/modules/project-management/project-management-prd-2.md` | **修改** | §4.6~§4.8 全面更新 + §5/§6 同步 |
| `logs-important/2026-05-03-conversation.md` | **新建** | 本文件 |

## 关键决策记录

1. **Role 独立性**: department_id nullable + SET NULL 软解绑 + project 级全局唯一 + 独立 Tab 入口
2. **部门多级**: 对齐 DB Schema parent_id 树形, name 唯一性保持 company_id 级别
3. **领域模型补全**: Company/Department/ExternalEntity 三实体 + Role 从域四迁入域一
4. **角色定位**: 核心参与者 > 组织架构修饰, UI 上体现为独立一级 Tab

## 下一步方向

prd-2.md 全部审核通过 → 可进入 Step 4 测试设计或 Step 5 编码
