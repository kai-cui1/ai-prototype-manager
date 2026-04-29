# 2026-04-29 重要对话记录

## 第一部分：Phase 1 Spec 审核与技术选型补充

### 背景
昨天（4/28）完成了 Phase 1 Design Spec（commit a326366），今天 PM 进行审核。

### 讨论内容

**PM 反馈**：Spec 2.2 节将 UI 组件库列为"后续决策"不合理——Phase 1 要实现项目管理、领域模型编辑、流程编辑器等功能，必须有 UI，不能延后。

**结论**：
1. **UI 组件库**：选定 **shadcn/ui**（基于 Radix UI + Tailwind CSS）
   - 理由：代码完全可控，适合编辑器类产品的高度定制需求
   - 带出依赖：**Tailwind CSS 3.x+**
2. **图形/画布库**：选定 **ReactFlow 12.x+**
   - 用于流程编辑器画布 + ER 图视图
   - 与 React 深度集成、API 简洁

**更新内容**：
- Spec 2.1 技术栈表新增 3 行（UI/CSS/画布）
- Spec 2.2 移除 UI 组件库条目
- 新增设计决策 PH1-16、PH1-17
- 同步更新 CLAUDE.md 技术栈表

---

## 第二部分：功能想法 — Holder 组织架构扩展

**PM 提出的新功能想法**：

当前 `process_nodes.holder_type` 只有 `role` | `service`。实际流程规划时常从部门/组织架构视角看行为执行者，Role 归属于 Department。

**扩展方向**：
- 新增 `department` 作为 holder_type 第三种取值
- 建立 Role ↔ Department 归属关系
- 泳道渲染支持按部门分组

**处理方式**：记录到 spec 第 13 章「Phase 1+ 扩展预留」13.1 节，建议归属 Phase 3 或 Phase 1.5。

---

## 第三部分：entity_relations 表设计深度讨论（核心）

### PM 提出的四个问题

PM 对 entity_relations 表的 type 和 cardinality 定义提出质疑，要求逐一讨论。

#### 问题 1：type = has / belongsTo 是否有结构性问题？

**AI 分析**：has 和 belongsTo 是同一关系的两面，用 type 区分是把"方向"和"性质"混在一起。如果用户想表达"A 和 B 的多对多关系"，当前模型无法清晰表达。

**PM 确认**：诊断正确。

#### 问题 2：cardinality 单值无法表达双向数量关系

**AI 分析**：一个关系天然是双向的（如 用户→订单是 1:N），单值只能描述一端。应拆成双字段或组合字符串。

**PM 确认**：方向对。

#### 问题 3：1 条记录还是 2 条？

**AI 分析倾向**：结合问题 1&2 结论，倾向于 1 条记录 + 双 cardinality。

**但此结论被后续 PM 决策覆盖**（见下）。

#### 问题 4：UML 方法论借鉴

**AI 分析 UML 核心概念**：
- Association（关联）、Aggregation（聚合）、Composition（组合）
- Multiplicity（多重性）在两端分别标注
- Role Name（端点名）

**关键启发**：type 不应是 has/belongsTo，而应描述关系的「性质」（association/aggregation/composition）；方向性由 source/target 自然表达。

### PM 的核心决策（反转了 AI 的部分推断）

**PM 明确表态**：
1. **拒绝"双向关联（Association）"**：认为它只是概括性描述，会导致 cardinality 解读模糊——每个方向的原因和数量约束往往不同。
2. **采用单向依赖关系**：A→B 表示 A 依赖 B（A 知道 B、A 用 B 的能力）。如果 B 也依赖 A，则由 B→A 的独立记录描述。
3. **Source 端隐含 = 1**：一条关系永远从单个实体视角出发，不需要 sourceCardinality 字段。只需 `targetCardinality`。
4. **targetCardinality 取值**：采用数学区间表示法——`*` 表示不限（多），数字表示精确值，`[min,max]` 表示范围（如 `[3,9]`）。

### 最终方案

```sql
entity_relations (
  relation_kind       -- dependency / aggregation / composition（3 种单向）
  target_cardinality  -- 区间表示法：'*' / '1' / '0' / '[0,1]' / '[3,9]' / '[1,*]'
  display_name        -- 每条记录自带显示名
  description         -- 此方向的关系原因
)
```

| 维度 | 原设计 | 新设计 |
|------|--------|--------|
| 关系类型 | has / belongsTo | dependency / aggregation / composition |
| 方向性 | 隐含在 type 中（混乱） | 明确单向，双向=2条记录 |
| 基数 | cardinality 单值（语义不清） | target_cardinality 单值（Source隐含=1） |
| 显示名 | inverse_name（仅反向） | display_name（每条自带） |
| 记录数 | 不明确 | 1条=1个单向关系 |

### 更新动作
- Spec 表 4 完整重写，含设计思路备注
- 设计决策 PH1-8 更新为新的表述

---

## 第四部分：数据库 vs 完整 Project 模型差距分析 + 新表补充

### 背景

PM 要求列出之前讨论的 Project 顶层模型及其内部结构，对比当前 12 张数据库表看还缺哪些。

### 分析过程

AI 搜索了全部 7 份核心设计文档（domain-model / shared-resources / object-lifecycle / component-library / business-process / semantic-layer-schema / external-design-integration），汇总出完整 Project 层次结构：

```
Project
├── meta
├── domainModels[] → EntityDef → fields[] + relations[]
├── roles[]                          ❌ 缺表
├── rules[]                          ❌ 缺表
├── externalEntities[]               ❌ 缺表
├── processNodes[] (全局池)           ✅ process_nodes
├── processEdges[] (全局池)           ✅ process_edges
├── businessProcesses[]              ✅ business_processes
├── processArchitecture?             ❌ 缺表（但 PM 决定改名+补上）
├── designArtifacts[]                ⏸️ PM 确认不急
└── applications[]                   ⚠️ applications 有表但不完整
    └── pages[]                      ⚠️ pages 有表但不完整
```

### 结论：12 张表覆盖约 40%，缺 14 张

**最紧迫**：
- P0: `roles` 表 — process_nodes.holder 引用 role 无数据源
- P0: `applications.type` 字段 — 缺少平台类型区分
- P1: `rules` 表 — 校验机制需要规则载体

### PM 决策

| 项目 | PM 决策 |
|------|---------|
| `roles` | **补上** |
| `external_entities` | **补上** |
| `design_artifacts` | **不急，以后再设计** |
| `process_architecture` | **补上，但改名为「业务架构」**（和流程节点区分开） |

### 执行动作

新增 3 张表到 Phase 1 Spec：

1. **roles**（表 13）：id/name/description/category/contact_info；actions/decisions JSONB 占位
2. **external_entities**（表 14）：id/name/description/entity_type/contact_info；actions/decisions JSONB 占位
3. **business_architectures**（表 15）：树形结构 parent_id 自引用；原名 process_architecture，PM 更名

同步更新内容：
- ER 关系图（4.3 节）— 新增 3 张表的关联线
- API 端点清单（5.4 节）— 新增 ~16 个端点（角色 5 + 外部实体 5 + 业务架构 6），总计 ~64 个
- 校验 Schema 文件结构（6.5 节）— 新增 participant.schema.ts + architecture.schema.ts
- Seed 数据（9.1 节）— 补充角色/外部实体/业务架构种子描述
- Monorepo 项目结构（3 节）— routes/services/types/pages 均补充新模块
- 设计决策汇总（12 节）— 新增 PH1-18/19/20
- 不在范围表（1.3 节）— design_artifacts 标注延后
- 差距分析报告保存到 `docs/20-analyze-report/database-vs-model-gap-analysis.md` 并更新

**总表数：12 → 15 张**
**总端点数：~48 → ~64 个**

---

## 第五部分：组织架构 + process_nodes 三处修改

### PM 提出的三个修改意见

1. **roles / external_entities 新增所属部门和公司**，同时新增 companies 表和 departments 表
2. **process_nodes.holder / holder_type 需要根据现有数据库设计重新设置引用关系**
3. **process_nodes.node_type 去掉 start/end/parallel/fork/join/merge**

### 讨论与确认

#### 关于 node_type 精简（第 3 点）

PM 明确：
- **Start/End 不作为独立节点**——由 `business_processes.entry_node_id` 和 `exit_node_ids` 隐含定义。渲染时根据 entry_node_id 在前面虚拟绘制起始点元素。因为不同流程视角下起始/结束可能不同。
- **Fork/Parallel 去掉**——一个节点发散出多个 edge 就代表并行（之前设计讨论已明确）。
- **Join/Merge 去掉**——PM 的核心观点：不需要额外标记 trigger_mode。当 3 个入边到达 2 条时需要其他处理逻辑怎么办？所以直接用 **decision** 来表达汇聚逻辑——多入边节点的出边由该节点的 holder 下的 decision 根据不同入边满足情况产生 branch。

**最终 node_type 仅 2 个值：`action` | `decision`**

| 原值 | 处理方式 |
|------|---------|
| ~~start~~ | 由 entry_node_id 定义，渲染时虚拟绘制 |
| ~~end~~ | 由 exit_node_ids 定义，渲染时虚拟绘制 |
| **action** | ✅ 保留 |
| **decision** | ✅ 保留，同时承担 Join 汇聚逻辑 |
| ~~parallel/fork~~ | 多出边隐含并行 |
| ~~join/merge~~ | 多入边→出边由 decision 的 branches 驱动 |

#### 关于 holder 引用关系（第 2 点）

原来 holder 是 TEXT（存 Role 名或 Service 名），改为外键引用：

```sql
holder_type  TEXT NOT NULL CHECK (holder_type IN (
  'role',             -- → holder_id 引用 roles.id
  'external_entity',  -- → holder_id 引用 external_entities.id
  'service'           -- → holder_id 引用 applications(type='service').id
)),
holder_id    TEXT NOT NULL,   -- 根据 holder_type 引用对应表 ID
```

新增复合索引 `(project_id, holder_type, holder_id)` 方便按参与者查询所有节点。

#### 关于组织架构（第 1 点）

新增 3 层组织架构模型：

```
companies (公司)
  └── departments (部门) ──→ roles (角色)
        └── self-referential: parent_id (多级部门)

external_entities (外部实体)
  └── 可选归属 company_id + department_id
```

### 执行动作

1. 新增 **companies** 表（表 13）：id/name/display_name/description/company_type/contact_info
2. 新增 **departments** 表（表 14）：company_id(FK) / parent_id(自引用,多级) / name / ...
3. **roles** 表（原表 13 → 表 15）：新增 department_id(FK NOT NULL)，角色必须归属于部门
4. **external_entities** 表（原表 14 → 表 16）：新增 company_id(可选 FK) + department_id(可选 FK)
5. **business_architectures** 表编号顺延至表 17
6. **process_nodes** 表重写：
   - node_type 精简为 action/decision（去掉 6 种）
   - holder TEXT → holder_type + holder_id 外键模式
   - 去掉 parallel_type 字段
   - 新增 holder 复合索引

### 同步更新内容

- ER 关系图（4.3 节）— 组织架构 3 层 + 总表数 17 → 18
- API 端点（5.4 节）— 新增公司(5) + 部门(6) = 11 个新端点，总计 ~80 → ~85
- 校验 Schema 结构（6.5 节）— participant.schema.ts → organization.schema.ts
- Seed 数据（9.1 节）— 补充公司/部门种子描述
- Monorepo 项目结构 — participant → organization（routes/services/types/pages）
- 设计决策汇总（12 节）— PH1-18/19/20/21/22 更新

---

## 第六部分：business_architectures 表调整 + business_processes 字段清理

### PM 提出的修改

1. **business_architectures.node_type**：从 `'group'/'category'/'marker'` 改为 `level: L1/L2/L3/L4`（表达业务架构层级）
2. **business_architectures.process_ids**：去掉 JSONB 冗余数组，用独立关系表 `biz_arch_process_map` 表达多对多
3. **business_processes.trigger_type / trigger_config**：去掉。流程执行方式由入口节点 holder 和行为自然定义
4. **business_processes.related_entities**：去掉。流程涉及的实体可从节点推导或 Service 缓存

### 执行动作

- `level` 替代 `node_type`（L1=顶层域 / L2=子域 / L3=模块组 / L4=具体分组）
- 新增 `biz_arch_process_map` 表（表 18）：architecture_id + process_id + sort_order
- 去掉 trigger_type、trigger_config、related_entities 三个字段
- 总表数：17 → 18
- API 端点：~80 → ~85（新增业务架构·流程映射 5 个端点）
- 设计决策：PH1-21 更新、新增 PH1-23/24

---

## 第七部分：系统菜单管理设计

### 背景

PM 指出 Phase 1 缺少菜单管理、系统角色、权限的设计，这会影响整个软件的系统架构和前后端代码结构。

### 讨论要点

**核心区分**：
- **系统级菜单/角色/权限**：软件自身的"后台管理系统"基础设施（谁能登录、看什么菜单）
- **业务流程 Role**：领域模型里的参与者概念（流程节点由谁执行）
- 两者完全无关

**技术选型冲突分析**：

| 方案 | 菜单能力 | 与 shadcn/ui 冲突？ |
|------|---------|:------------------:|
| Ant Design Pro | 内置完整菜单+路由+权限 | ❌ 选了 shadcn/ui |
| React Admin | 内置 CRUD + 权限 | ❌ 偏 CRUD 后台 |
| Refine | 内置 auth/provider/菜单 | ⚠️ 支持 shadcn/ui 但偏 CRUD |
| React Router v6 | 纯路由无菜单 | ✅ 最灵活 |

**结论**：已选定 shadcn/ui = 选择了"组件库路线"，Layout/Sidebar/Menu 需自己组装。

### PM 决策：轻量版菜单系统

- **菜单存数据库**（menus 表），后端 API 下发驱动 Sidebar 渲染
- **路由前端硬编码**（React Router v6），不做动态路由注册
- **roles/permissions 字段预留**（JSONB 占位），Phase 3 启用
- 不需要 menu_schemes 多套方案（Phase 1 一套够用）

### menus 表设计（表 19）

```sql
menus (
  id, parent_id(自引用), name, display_name, icon,
  path,                          -- 对应路由路径
  menu_type IN('menu','directory','separator'),
  sort_order, visible,
  roles JSONB '[]',              -- Phase 3 启用
  permissions JSONB '[]',        -- Phase 3 启用
)
```

### 同步更新

- 技术栈表新增 **React Router v6**
- CLAUDE.md 技术栈同步更新
- ER 图新增 menus 表（系统级，不归属 Project）
- API 端点新增系统菜单 6 个（~85 → ~91）
- 项目结构新增 menu route/service/type
- 校验 Schema 新增 menu.schema.ts
- Seed 数据新增系统菜单种子
- Done Demo 场景重写（加入 Sidebar + 菜单管理页面）
- 设计决策 PH1-25

**总表数：18 → 19 张 | 总端点数：~85 → ~91 个**
