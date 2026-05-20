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

---

## 第八部分：Spec 自检（11 个问题逐项修复）

### 背景

PM 要求从 MVP 可用系统角度，结合 Done Demo 场景完整走查 Spec，发现遗漏。

### 发现的 11 个问题（按严重度排列）

#### P0 — 严重阻塞（2 项）

**问题 1：applications 表缺少 type 字段**
- process_nodes.holder_type='service' 引用 applications(type='service').id
- 但 applications 表没有 type 字段，数据完整性断裂
- **修复**：新增 `type TEXT NOT NULL DEFAULT 'web'`，7 种枚举值（web/wxapp/android/ios/pc/api/service）

**问题 2：L2 校验描述过时**
- 写着"node_type 校验（8 种）"，实际只有 action/decision 两种
- **修复**：改为 "node_type 校验（2 种：action / decision）"

#### P1 — 中等问题（4 项）

**问题 3：循环检测零定义**
- Done Demo 写了"循环检测警告"但 Spec 完全没定义
- **修复**：两端都做 + 阻断策略。后端创建边时 DFS 检测返回 422 UNPROCESSABLE_ENTITY；前端画布即时检测阻断。算法：从 target DFS 回到 source 则成环。错误码复用 UNPROCESSABLE_ENTITY

**问题 4：缺 MenuManagementPage**
- pages 列表缺菜单管理页组件
- **修复**：补充到 Monorepo 页面列表

**问题 5：validation-schemas 文件清单不同步**
- 3 节 Monorepo 结构列 4 个文件，6.5 节列 7 个文件
- **修复**：3 节补全为 7 个文件（+ base/organization/architecture/menu）

**问题 6：entryNode 双重定义冲突**
- business_processes.entry_node_id vs process_node_map.sort_order=0 都在定义"入口节点"
- **修复**：明确 entry_node_id 为唯一权威入口；sort_order 仅用于排序，注释已修正

#### P2 — 轻微问题（5 项）

| # | 问题 | 处理 |
|---|------|------|
| 7 | 工作台无实现 | Phase 1 去掉工作台菜单 |
| 8 | 项目列表搜索参数未定义 | API 补充 name 搜索 + status 筛选 |
| 9 | 删除角色级联行为未定义 | 阻止删除策略（422 + 引用详情） |
| 10 | ER 图 ReactFlow 映射规格缺失 | 延后到「系统模块详细设计」阶段 |
| 11 | field_type UI 子集未枚举 | 同上 |

### 产出物
- Spec 9 处修改
- 自检报告：`docs/20-analyze-report/phase1-spec-self-review.md`（含完整修复记录）
- Git commit: `32e7b05`

---

## 第九部分：下个阶段讨论

### PM 提问："下个阶段是什么？"

### 回答：两层含义

**A. Roadmap 层面：Phase 1 → Phase 2**
- Phase 0 ✅ 100% → Phase 1（当前：Spec ✅，实施 ○）→ Phase 2（核心引擎）

**B. Phase 1 内部层面：Spec → 实施 → 编码**
- Phase 1 有 8 个子任务（1.1~1.8），Spec 覆盖了数据架构层
- 下一步是**系统模块详细设计**（ER 图 ReactFlow 映射、画布交互细节、field_type 子集、前端布局框架等），然后开始编码

### PM 的判断
- 需要整理对项目阶段的理解，写成文档放在项目里
- Spec 做完后、编码前，应该有更详细的下一级设计过程
- 这层设计的粒度和形式待 PM 决定

---

## 第十部分：Roadmap 颗粒度重构讨论（V3 → V4）

### 背景

PM 在整理对项目阶段理解的过程中，仔细阅读了 Roadmap V3 的 Phase 1 任务定义，发现**任务颗粒度混乱**——8 个任务混了 3 种不同维度（基础设施 / 功能模块 / UI 层），且描述与已完成的 Spec 严重脱节。

### PM 发起的问题

> "我认为这里面写的任务很多都不在一个维度上，请你仔细分析一下，结合我们目前已经完成的 spec，和我讨论下 roadmap 要制定到什么颗粒度"

### AI 分析结果：3 类问题

#### 问题 1：任务描述与 Spec 实际内容严重脱节（5 处）

| Roadmap 任务 | 写的内容 | Spec 实际状态 |
|---|---|---|
| **1.2** | "12+ 核心表"（列出了原始 12 张表名） | **已完成**：Spec 定义了 **19 张表** |
| **1.5** | 含"成员角色管理" | Spec 明确 **不做认证**，无成员概念 |
| **1.6** | 关系定义写 `type: has\|belongsTo` | 已改为 `relation_kind: dependency\|aggregation\|composition` |
| **1.7** | 节点类型列了 8 种（Action/Decision/Start/End/Parallel/Fork/Join/Merge） | 已精简为 **2 种**（action/decision） |
| **1.8** | 只提 3 个页面 | 实际有 **7 个页面**（+OrganizationPanel/ArchitectureView/MenuManagement） |

#### 问题 2：Spec 新增的模块在 Roadmap 中完全缺失

Spec 审核过程中新增了 **3 大功能模块**，但 roadmap 里没有对应任务：

| 新增模块 | 涉及表数 | API 端点数 | Roadmap 位置？ |
|---|---|---|---|
| **组织架构管理**（公司/部门/角色/外部实体） | 4 张（表 13-16） | ~21 个 | ❌ 无 |
| **业务架构管理**（架构树 + 流程映射） | 2 张（表 17-18） | ~11 个 | ❌ 无 |
| **系统菜单管理** | 1 张（表 19） | 6 个 | ❌ 无 |

这 3 个模块占 Phase 1 总量的 **37%**（7 表 / ~38 端点 / 3 页面），但在 roadmap 中不存在。

#### 问题 3：Phase 内部颗粒度不统一——最根本的问题

当前 8 个任务混了 **3 种不同维度**：

```
维度 A — 基础设施/横切关注点：
  1.1 项目初始化（搭建脚手架）
  1.3 TypeScript 类型定义
  1.4 校验机制

维度 B — 功能模块（业务领域）：
  1.5 项目管理模块
  1.6 领域模型管理模块
  1.7 业务流程管理模块
  ??? 组织架构管理      ← 缺失
  ??? 业务架构管理      ← 缺失
  ??? 菜单管理          ← 缺失

维度 C — UI 层：
  1.8 MVP 操作界面（"UI"作为一个独立任务，依赖所有功能模块）
```

**核心矛盾**：1.2 写的是"数据库设计"，但这其实是设计阶段的产出（已在 Spec 中完成）。如果 Phase 1 是"实施阶段"，那 1.2 应该变成"数据库初始化 + Drizzle Schema 实现"。同样，1.3/1.4 是代码层的横切基础设施，和 1.5-1.7 的"功能模块"不是同一层级的东西。

---

## 第十一部分：PM 提出的开发流程框架（核心决策）

### PM 的完整思路

PM 提出了一套完整的 **两层级 Roadmap 方法论**：

#### 第一层级：Phase 内按「可独立交付验收的功能单元」拆分

每个 Phase 包含若干个功能模块，如：
- 项目管理 / 领域模型 / 业务流程 / 组织架构 / 业务架构 / 菜单管理

#### 第二层级：每个功能模块内部按「软件工程职能切面」分 7 步

| 步骤 | 名称 | 产出物 | 对应 docs/ 目录 |
|------|------|--------|:---------------:|
| 0 | 产品思路 & 想法 | 模糊方向、未被详细讨论的 idea | `01-design-idea/` |
| 1 | 领域模型 & 业务流程设计 | 实体关系、数据流、业务对象属性 | `02-domain-model/` |
| 2 | 产品 PRD 设计 | 功能结构、页面交互逻辑、业务规则；HTML 高保真原型 | `03-prd/` |
| 3 | 前后端详细技术方案 | 技术选型、架构图、DB 设计规范、API 规范、组件交互序列图、重点技术方案 | `04-tech-design/` |
| 4 | 测试用例设计 | 测试方案 + 用例集（编码前先写） | `06-test-design/` |
| 5 | 前后端代码实现 | 具体编程任务（接口/页面级颗粒度） | `packages/` (代码) |
| 6 | 单元测试 & 集成测试 | 测试代码 | `packages/` (代码) |
| 7 | 部署方案设计 | 部署架构图、环境配置 | `07-deploy-design/` |

另有 `05-data-design/` 存放后端 DDL 和前端数据方案细节。

**关键原则：每个阶段框定功能范围 → 走完 7 步 → 再进入下一阶段**

### PM 的原话记录

> "我是这么考虑的，在项目开始的时候，因为我们要做基础选型，比如前后端技术栈，这些属于'切面'，但确实是一开始要做的决策，这个技术选型通常放在我们 roadmap 的第一步，但是后续会进入到系统功能的实现，这时候 roadmap 就应该按「可独立交付验收的功能单元」拆分。"
>
> "每个功能模块内部要按照职能切面（也就是软件工程的开发流程）来分步骤...每一个阶段，我希望我们都一起框定一些功能范围，走上面的流程去制定详细的 roadmap"

---

## 第十二部分：关键决策确认（AskUserQuestion 三轮）

### 决策 1：推进节奏

**选项**：逐模块串行 / M1 先行后并行 / 全部 Step 4 先行

**PM 选择**：**逐模块串行（M1 → M2 → M3 → M4 → M5 → M6）**

**理由**：首次磨合新流程，先走通一个完整周期验证可行性。

### 决策 2：文档组织形式

**选项**：单文件 markdown / 多文件拆分 / Roadmap 与实施计划分离

**PM 选择**：**按照已有的 docs/ 目录结构来组织**

PM 详细说明了目录体系：

```
docs/
├── 01-design-idea/     产品思路、模糊方向
├── 02-domain-model/    领域模型设计产物
├── 03-prd/             产品需求规格说明书 + HTML 交互原型
├── 04-tech-design/     技术方案设计（宏观架构 + 模块级细粒度）
├── 05-data-design/     后端 DB DDL + 前端数据方案
├── 06-test-design/     测试方案 + 测试用例
└── 07-deploy-design/   部署方案 + 部署架构图
```

每个编号对应开发流程的一个步骤，形成清晰的文件→步骤映射。

### 决策 3：Phase 1 边界

**选项**：排除 4 张表 / applications 基础 CRUD 加入

**PM 选择**：**applications / pages / page_layout_regions / data_flow_metadata 纳入 Phase 2，标记为「待整合」**

**理由**：要按照新的思路梳理 roadmap 颗粒度，这 4 张表的 CRUD 不在 Phase 1 范围内。

---

## 第十三部分：执行动作

### 1. 重写 Roadmap 为 V4 版本

文件：`docs/02-roadmap.md`

**核心变更**：
- Phase 0 保持不变（13 项任务全部完成）
- Phase 1 从 8 个混合任务 → **前置基础设施 INF(1~6) + 6 个功能模块 M(1~6) × 7 步矩阵**
- 每个模块的 Step 5 细化到具体编程任务（BE 接口级 / FE 页面级）
- Step 1&3 标记 ✅（已在 Spec 中完成），Step 2 标 ○ 待做（PRD 尚未编写）
- Step 4 标 ○ 待做（测试用例尚未设计）
- Phase 2 标注 applications 等 4 张表为「⚠️ 待整合」
- 进度追踪从一维表格 → 二维矩阵（模块 × 步骤）
- 新增「文档目录索引」章节和「V3→V4 变更说明」章节

### 2. 迁移 Phase 0 散落文件到对应目录

使用 `git mv` 移动 7 份文件：

| 原路径 | 新路径 | 归属原因 |
|--------|--------|---------|
| `03-semantic-layer-schema.md` | `02-domain-model/semantic-layer-schema.md` | Schema 骨架 = 领域模型 |
| `04-app-shared-resources.md` | `02-domain-model/app-shared-resources.md` | 共享资源 = 领域模型一部分 |
| `07-component-library.md` | `02-domain-model/component-library.md` | 组件库定义 = 领域模型 |
| `08-business-process.md` | `02-domain-model/business-process.md` | 流程系统 = 领域模型 |
| `05-object-lifecycle.md` | `04-tech-design/object-lifecycle.md` | 交互范式 = 技术方案 |
| `06-external-design-integration.md` | `04-tech-design/external-design-integration.md` | 外部集成 = 技术方案 |
| `09-mcp-interface.md` | `04-tech-design/mcp-interface.md` | MCP 接口 = 技术方案 |

原文件名中的数字前缀去掉，避免与目录编号混淆。

### 3. Git 提交并推送

- Commit: `b3caf52` — `docs: Roadmap V4 重构 — 功能模块 × 7 步开发流程矩阵`
- 已 push 到 `origin/feature/phase1`

---

## 当前状态总结

**已完成**：
- ✅ Phase 0 设计规格冻结（13/13）
- ✅ Phase 1 Design Spec（19 表 / 91 端点 / 25 决策）
- ✅ Roadmap V4 重构（新框架落地）
- ✅ 文档目录归位（7 份文件迁移）

**下一步自然入口**：
- **M1 Step 2**：项目管理模块 PRD 设计 → `03-prd/m1-project-prd.md`
- 或 **M1 Step 4**：项目管理模块测试用例设计 → `06-test-design/m1-project-test.md`
- 或 **INF 前置基础设施**：Monorepo 初始化等 6 项共享基础代码

---

## 第十四部分：文档目录归位讨论（发现遗漏文件）

### 背景

PM 在查看最终 docs/ 目录时发现仍有 3 个（+1 个目录）文件不在已建立的 01~07 目录体系内：

| 文件 | 性质 | 行数 |
|------|------|:----:|
| `02-roadmap.md` | 项目总路线图 / 进度追踪 | ~500 |
| `workflow.md` | PM-AI 协作 A→F 六阶段工作流定义 | ~589 |
| `superpowers/specs/phase1-design.md` | Phase 1 技术规格（Step 1+3 混合体） | ~1216 |
| `20-analyze-report/` | 分析报告（2 份） | — |

### PM 发起的问题

> "我注意到还有几个文件遗漏在文档规范之外，请你分析一下并且给出建议"

### AI 分析结果

3 个文件分别属于不同性质：
- **roadmap.md**：项目元文档，不归属任何单一步骤，是所有步骤的索引
- **workflow.md**：方法论文档，描述「怎么协作」
- **phase1-design.md**：Step 1（领域设计）+ Step 3（技术方案）混合产出，放在了非标准目录 `superpowers/specs/` 下

---

## 第十五部分：文档归位决策与执行（四轮 AskUserQuestion）

### 决策 1：roadmap.md → 新建 `00-project/` 元数据目录

PM 选择新建专门的元数据目录存放 roadmap 等项目级文件。

### 决策 2：workflow.md → `03-prd/workflow/` + 新建子目录

PM 决定：
- 移入 `03-prd/workflow/`（因为 workflow 定义的是从粗到细的完整工作流程，可视为产品交互规范的一部分）
- 在 `03-prd/` 下新建 2 个子目录：
  - `workflow/` — 存放业务流程/工作流文档
  - `prototypes/` — 存放 HTML 格式的高保真交互原型

### 决策 3：phase1-design.md → 拆分为 3 份 + 归档

PM 要求：
1. 原件拷贝到 `99-archived/`（新建归档目录，专门存放已被替代的历史版本）
2. 按内容所属拆分到对应目录：
   - §4 表定义（19 张表 DDL + ER 图）→ `05-data-design/`（首次填充此目录）
   - §1-3 + §5-12（技术方案主体）→ `04-tech-design/`
   - §13 扩展预留（功能想法）→ `01-design-idea/`

**关键修正**：AI 初版方案把 §13 归入技术方案，PM 指出"这部分应该放入 01-design-idea，因为属于一些新功能的想法"

### 决策 4：20-analyze-report/ 保持根目录不动

过程性分析报告，不纳入 07 步流程。

### 决策 5：CLAUDE.md 必须新增强制规范

PM 明确要求：**更新 CLAUDE.md 文件，强调不同工作阶段输出产物必须放在哪个目录。我们当前就出现了文档被放在了 superpowers 目录里的问题**

在 CLAUDE.md 中新增了完整的「文档目录强制规范」章节，包含：
- 7 步流程 × 目录映射表
- ❌ 禁止行为（不要创建 superpowers/ 等）
- 违规示例（以 superpowers/specs/ 和根目录散落文件为反面教材）

### 执行动作

1. 创建目录：`00-project/`、`03-prd/workflow/`、`03-prd/prototypes/`、`99-archived/`、`05-data-design/`（首次填充）、`06-test-design/`（空）、`07-deploy-design/`（空）
2. git mv：`02-roadmap.md` → `00-project/roadmap.md`
3. git mv：`workflow.md` → `03-prd/workflow/workflow.md`
4. cp 归档：`superpowers/specs/phase1-design.md` → `99-archived/`
5. Write 新建 3 个拆分文件：
   - `05-data-design/phase1-database-schema.md`（§4 全部，19 张表）
   - `04-tech-design/phase1-design-tech.md`（§1-3+5-12 全部）
   - `01-design-idea/phase1-extension-ideas.md`（§13 全部）
6. 更新 Roadmap 中 Spec 引用路径（旧路径 → 新拆分路径）
7. 更新 CLAUDE.md（目录结构 + 强制规范 + 引用路径）
8. 删除空目录 `superpowers/specs/`
9. Git commit `6cafeaa` + push

### 最终文档结构（执行后）

```
docs/
├── 00-project/roadmap.md              ← Roadmap V4
├── 01-design-idea/
│   ├── 01-design-idea.md
│   └── phase1-extension-ideas.md    ← 新建
├── 02-domain-model/                  ← 5 份
├── 03-prd/
│   ├── workflow/workflow.md          ← 从根目录移入
│   └── prototypes/                 ← 新建（空）
├── 04-tech-design/                 ← 5 份 + phase1-design-tech.md（新建）
├── 05-data-design/
│   └── phase1-database-schema.md   ← 新建（首次填充）
├── 06-test-design/                  ← 空（待填充）
├── 07-deploy-design/               ← 空（待填充）
├── 99-archived/
│   └── 2026-04-28-phase1-design.md ← 原件归档
└── 20-analyze-report/              ← 不动
```
