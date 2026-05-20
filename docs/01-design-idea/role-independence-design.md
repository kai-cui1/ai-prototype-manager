# Role 独立性设计决策

> **日期**: 2026-05-03
> **状态**: ✅ 已审核通过
> **背景**: M1 PRD 审核中发现 Role 被强制绑定到 Department 的问题，2C 场景下无法独立使用

---

## 问题

### 原始设计（有问题）

```
Project(1) ──< (N) Company(1) ──< (N) Department(1) ──< (N) Role [强制]
```

- DB: `roles.department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE`
- Role 必须属于某个 Department，无法独立存在
- 删除公司 → 级联删除 departments + roles
- 删除部门 → 级联删除 roles

### 核心矛盾

| 项目类型 | 组织架构需求 | 角色需求 | 原始设计是否可行 |
|---------|------------|---------|:---------------:|
| 2B（如换电站管理） | 有完整公司/部门结构 | 角色挂载到部门下 | 可行 |
| 2C（如社交 App） | 无公司/部门概念 | 仍需角色（用户/访客/VIP） | **不可行** — 需先建虚拟组织 |

**根因**: 把「业务流程中的参与者角色」和「组织架构中的岗位」强绑定了。这两者是不同维度的概念。

---

## 设计决策

### 决策 1：Role 归属 — 可选挂载

`department_id` 从 `NOT NULL` 改为 **nullable**：

```sql
-- 变更后
department_id TEXT REFERENCES departments(id) ON DELETE SET NULL
```

- 不挂载时（`department_id = null`）：Role 直接属于 Project，为**独立角色**
- 挂载时（`department_id != null`）：Role 关联到某部门，为**组织角色**
- 两种角色都能被 `process_nodes.holder` 引用

### 决策 2：删除组织 — 软解绑

删除 Company 或 Department 时，**不清除 Role 本身，只清空挂载关系**：

| 操作 | 对 Role 的影响 |
|------|-------------|
| 删除 Department | 该部门下的 role.department_id → SET NULL（变为独立角色） |
| 删除 Company | 先 CASCADE 删下属 departments（触发上述 SET NULL），再删 company |

**不级联删除 Role** 的原因：
- Role 可能被 `process_nodes` 或 `domain_entities` / `business_processes` 引用
- 软解绑更安全，保留数据完整性
- 用户可后续手动整理或重新挂载

### 决策 3：UI 导航 — 独立入口 + 组织快捷筛选

组织架构 Tab 下三个并列子区域：

```
组织架构 Tab
├── 子 Tab: 公司部门     ← 公司列表 → 选中→部门列表
│   └── 公司卡片显示 "N 个已挂载角色" 徽章 → 点击筛选
├── 子 Tab: 角色         ← 独立角色面板（全部 project 角色）
│   ├── 工具栏: 新建角色 + 搜索 + 筛选器（按部门筛选）
│   └── 角色卡片列表（显示所属部门 or "独立" 标记）
└── 子 Tab: 外部实体     ← 保持不变
```

新建角色对话框增加选项：
- 「挂载到部门」（下拉选择，可选）
- 不选 = 创建独立角色

### 决策 4：name 唯一性 — Project 级全局唯一

| 字段 | 唯一性范围 | 说明 |
|------|-----------|------|
| `name` | 同 `project_id` 内全局唯一 | 不管是否挂载到部门 |
| `display_name` | 可重复 | 仅展示用途 |

约束：`UNIQUE(project_id, name)` — 与当前 schema 一致，无需变更。

---

## 变更影响清单

### DB Schema（1 张表）

| 表 | 变更 | 详情 |
|----|------|------|
| `roles` | `department_id`: NOT NULL → nullable, ON DELETE CASCADE → SET NULL | 核心变更 |

### PRD §4.8 角色管理 — 全面重写

| 区域 | 当前内容 | 变更方向 |
|------|---------|---------|
| 4.8.1 领域模型 | Role 强制属于 Department(N:1) | Role **可选**属于 Department，直接属于 Project |
| 4.8.2 页面设计 | 三级级联导航（公司→部门→角色） | 独立角色面板 + 新建时可选择挂载目标 |
| 4.8.3 交互行为 | 必须先选部门才能建角色 | 新建时 department_id 为可选字段 |
| 4.8.4 业务规则 | B-M1-54: 删部门→级联删 roles | 改为：删部门→解绑 roles (SET NULL) |
| 4.8.5 数据规格 | 输出含 dept_id（必填） | dept_id 改为可空，新增"归属标记"字段 |

### PRD §4.6 公司管理 — 局部调整

| 规则 | 当前 | 变更 |
|------|------|------|
| B-M1-39 | 删公司→级联删 departments + roles | 删公司→级联删 departments + 解绑 roles |
| 4.6.5 输出数据 | role_count 含义不变 | 含义微调：统计"挂载到该公司"的角色数 |

### PRD §4.7 部门管理 — 局部调整

| 规则 | 当前 | 变更 |
|------|------|------|
| B-M1-54 | 删部门→级联删 roles | 删部门→解绑 roles (SET NULL) |
| 4.7.5 输出数据 | role_count 含义不变 | 统计"挂载到该部门"的角色数 |

---

## ER 关系图（变更后）

```
Project (1)
  ├── (N) domain_entities (1)──(N) entity_fields
  ├── (N) entity_relations
  ├── (N) data_flow_metadata
  ├── (N) business_processes ...
  │
  ├── 组织架构（松耦合）：
  │   ├── (N) companies
  │   │   └── (N) departments [parent_id 自引用, 多级]
  │   │       └── ◄── (N) roles [可选挂载, department_id nullable FK]
  │   │
  │   └── (N) external_entities
  │
  └── (N) roles [独立角色, department_id = null]
        ↑ 全部归属于 Project（project_id FK）
```

**关键语义变化**：Role 从「组织的叶子节点」变为「Project 级别的参与者」，组织架构只是它的可选挂载点。
