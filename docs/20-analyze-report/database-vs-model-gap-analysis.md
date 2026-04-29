# 数据库设计 vs 完整 Project 模型 — 差距分析报告

> **日期**：2026-04-29
> **更新**：2026-04-29（补充 roles/external_entities/business_architectures 后）
> **目的**：对比 Phase 1 Spec 中数据库表与完整 Project 顶层模型定义，识别缺失与不完整的部分

---

## 一、完整 Project 顶层模型（来自设计文档）

```
Project（顶级容器）
│
├── meta                              ← 项目元信息
│
├── domainModels[]                    ← 领域模型
│   └── DomainModelDef
│       ├── EntityDef → fields[] + relations[] + behaviors[] + dataFlow
│       └── FieldDef（26 种字段类型）
│
├── roles[]                           ← 角色定义（actions[] + decisions[] + tool）
├── rules[]                           ← 业务规则（纯函数，无副作用）
├── externalEntities[]                ← 外部实体（actions[] + decisions[]）
│
├── processNodes[] (全局原子节点池)    ← ActivityNode + DecisionNode
├── processEdges[] (全局边池)          ← 连接 + 数据传递 mappings
├── businessProcesses[]               ← 流程定义（引用全局池 ID）
│   └── process_node_map（流程→节点多对多映射）
├── processArchitecture?              ← 可选：流程架构树（分类导航）
│
├── designArtifacts[]                 ← 导入的外部设计稿
│
└── applications[]                    ← 平台应用列表
    │
    ├── Application (type: web/android/ios/pc)
    │   ├── pages[]
    │   │   ├── Page（特殊 Component）
    │   │   │   ├── components[] (组件树, 递归)
    │   │   │   ├── zones[] (逻辑分区)
    │   │   │   ├── hooks[] (交互钩子)
    │   │   │   └── lifeCycles[] / permissions / layoutHint
    │   │   └── ...
    │   ├── globalActions[]           ← 全局内置行为（8 类 21 个）
    │   ├── timers[]                  ← 前端定时器
    │   └── conventions[]             ← [预留] 交互规范
    │
    ├── Application (type: api)
    │   ├── endpoints[]               ← HTTP 接口端点
    │   ├── globalActions[]
    │   └── timers[]
    │
    ├── Application (type: service)
    │   ├── actions[]                 ← 业务行为（有副作用）
    │   ├── scheduleTasks[]           ← 计划任务
    │   ├── globalActions[]
    │   └── timers[]
    │
    └── Application (type: android/ios/pc)
        └── 同 web 类型的结构
```

### 设计文档来源

| 文档 | 内容 |
|------|------|
| `docs/02-domain-model/domain-model.md` | 元模型定义（19 个实体完整字段+关系+ER 图） |
| `docs/04-app-shared-resources.md` | App 级共享资源体系、26 种字段类型、Context API |
| `docs/05-object-lifecycle.md` | 对象生命周期交互范式（Hook 完整 Schema） |
| `docs/07-component-library.md` | 标准组件库（~52 组件/6 分类） |
| `docs/08-business-process.md` | 业务流程系统（三层架构/全局节点池/参与者） |
| `docs/03-semantic-layer-schema.md` | 语义层 Schema 骨架（11 个一级节点早期定义） |
| `docs/06-external-design-integration.md` | 外部设计稿集成 |

---

## 二、当前数据库 12 张表 vs 完整模型对比

### 2.1 已有且完整（4 组）

| # | 设计模型 | 数据库表 | 覆盖程度 |
|---|---------|---------|---------|
| 1 | **Project** | `projects` | ✅ 完整：id/name/display_name/description/status/version/config/timestamps |
| 2 | **EntityDef + FieldDef + RelationDef** | `domain_entities` + `entity_fields` + `entity_relations` | ✅ 完整：含 category/sort_order/26 种 field_type/区间表示法 cardinality |
| 3 | **Process 全局池 + 流程** | `process_nodes` + `process_edges` + `business_processes` + `process_node_map` | ✅ 完整：8 种 node_type/mappings/条件边/子流程嵌套/entry_node |
| 4 | **DataFlow 元数据** | `data_flow_metadata` | ✅ 完整：sources/destinations/notes |

### 2.2 有表但不完整（2 组）

| # | 设计模型 | 当前数据库表 | 缺失内容 |
|---|---------|------------|---------|
| 5 | **Application** | `applications` | - 缺少 `type` 字段区分平台（web/api/service/android/ios/pc）<br>- 缺少关联的 endpoints/actions/globalActions/timers/conventions/scheduleTasks<br>- 当前只有基础字段，无法表达不同 type 的差异化结构 |
| 6 | **Page + Zone** | `pages` + `page_layout_regions` | - Page 缺 components 树（递归 children[]）<br>- Page 缺 hooks[]（交互钩子）<br>- Page 缺 lifeCycles[] / permissions<br>- Zone 只有 layout_region 基础版，缺 componentIds 关联 |

### 2.3 完全缺失（按领域分组）

#### A. 参与者体系（3 张 → 1 张待补）

| # | 状态 | 表名 | 设计来源 | 说明 |
|---|:----:|------|---------|------|
| 7 | ✅ **已补** (4/29) | `roles` | `Project.roles[]` | Role 定义：name/description/category/contact_info；actions/decisions JSONB 占位 |
| 8 | ✅ **已补** (4/29) | `external_entities` | `Project.externalEntities[]` | 外部实体：name/description/entity_type/contact_info；actions/decisions JSONB 占位 |
| 9 | ❌ 待补 | `members` | `Project.members[]` | 项目成员：userId/name/email/roleInProject；Phase 1 不做认证，延后至 Phase 3 |

#### B. 业务逻辑层（4 张）

| # | 缺失表 | 设计来源 | 说明 | 所属应用 |
|---|--------|---------|------|---------|
| 10 | `rules` | `Project.rules[]` | 业务规则：domain/formula/inputs[]/outputs[]/logic{userDesc,data} | Project 根级共享 |
| 11 | `actions` | `applications[type=service].actions[]` | 业务行为：inputs/outputs/sideEffects/logic/errorHandlers | service 应用内 |
| 12 | `schedule_tasks` | `applications[type=service].scheduleTasks[]` | 计划任务：cron/actionRef/params/enabled/retryPolicy | service 应用内 |
| 13 | `endpoints` | `applications[type=api].endpoints[]` | API 端点：method/path/request{body,queryParams}/response/actionRef/errorCodes | api 应用内 |

#### C. UI 交互层（5 张）— 属于 Phase 2 范围

| # | 缺失表 | 设计来源 | 说明 |
|---|--------|---------|------|
| 14 | `components` | `pages[].components[]` | 组件树：~52 种类型/6 大分类/ComponentBase/props(bindings)/children(递归)/lifeCycles/hooks/layout |
| 15 | `hooks` | `components[].hooks[]` / `pages[].hooks[]` | 交互钩子：event/condition/actionCall[]/{userDesc,data} JS 函数 |
| 16 | `global_actions` | `applications[].globalActions[]` | 全局内置行为：8 类 21 个预定义行为（navigation/overlay/data/uiControl/notification/system/extension） |
| 17 | `timers` | `applications[].timers[]` | 定时器：onTick{userDesc,data} JS 函数 / interval/repeat |
| 18 | `conventions` | `applications[].conventions[]` | [预留] 交互规范定义 |

#### D. 其他（2 张 → 1 张待补 + 1 张延后）

| # | 状态 | 表名 | 设计来源 | 说明 |
|---|:----:|------|---------|------|
| 19 | ⏸️ **延后** (PM 4/29 确认) | `design_artifacts` | `Project.designArtifacts[]` | 导入的外部设计稿：type(html/image)/sourceUrl/pageMapping/version/metadata；后续 Phase 再设计 |
| 20 | ✅ **已补** (4/29) | `business_architectures` | `Project.processArchitecture?` | 原名 process_architecture，PM 决策更名为「业务架构」；树形分类结构（parent_id 自引用），纯手动维护 |

---

## 三、差距统计总览（4/29 更新后）

| 类别 | 已覆盖 | 有表不完整 | 完全缺失 | 合计 |
|------|:------:|:----------:|:--------:|:----:|
| 参与者体系 | **2** (roles + external_entities) | 0 | **1** (members) | 3 |
| 领域模型 | **3** | 0 | 0 | 3 |
| 业务流程 | **2** (流程组 + 业务架构) | 0 | 0 | 2 |
| 应用框架 | 0 | **2**（Application/Page） | 0 | 2 |
| 业务逻辑层 | 0 | 0 | **4** | 4 |
| UI 交互层 | 0 | 0 | **5** | 5 |
| 其他 | **1** (business_architectures) | 0 | **1** (design_artifacts 延后) | 2 |
| 组织架构 | **4** (companies+departments+roles+extEntities) | 0 | **1** (members) | 5 |
| **总计** | **8 组** | **2 组** | **12 张** | **22 个模块** |

> 注：当前数据库已有 **17 张表**（12 原始 + roles+extEntities+bizArch+companies+departments），完整模型需要约 **28 张表**（不含 members/design_artifacts 延后），剩余差距约 **11 张表**。

---

## 四、Phase 1 影响评估（4/29 更新后）

### 4.1 已补上 ✅

| 优先级 | 补充项 | 状态 |
|:------:|--------|------|
| **P0** | `roles` 表 | ✅ 已补：基础版（id/name/description/category/contact_info），actions/decisions JSONB 占位 |
| **P0** | `external_entities` 表 | ✅ 已补：基础版（id/name/description/entity_type/contact_info），actions/decisions JSONB 占位 |
| **P1** | `business_architectures` 表 | ✅ 已补：树形结构（parent_id 自引用 + node_type + process_ids） |

### 4.2 仍待处理

| 优先级 | 待补项 | 原因 |
|:------:|--------|------|
| **P0** | `applications.type` 字段 | 当前 applications 表缺少平台类型区分，后续所有按 type 分化的子对象都无法归位 |
| **P1** | `rules` 表（基础版） | 校验机制（Task 1.4/1.5）的 L2 层级校验需要规则载体；即使 Phase 1 只做公式存储也需要表结构 |

### 4.3 明确延后（不在 Phase 1）

| 缺失项 | 延后原因 | 建议归属 Phase |
|--------|---------|---------------|
| `members` | 不做认证 | Phase 3 |
| `components` | 交互原型能力移至 Phase 2 | Phase 2.7-2.9 |
| `hooks` | 依赖 components | Phase 2.1-2.2 |
| `actions` | 业务逻辑层 | Phase 2+ |
| `schedule_tasks` | 业务逻辑层 | Phase 2+ |
| `endpoints` | API 定义层 | Phase 2+ |
| `global_actions` | UI 交互层 | Phase 2+ |
| `timers` | UI 交互层 | Phase 2+ |
| `conventions` | 预留功能 | Phase 3+ |
| ~~process_architecture~~ | → 已更名为 **business_architectures** 并在 Phase 1 补上 ✅ | — |

---

## 五、建议的 Phase 1 补充方案（4/29 更新后）

### 已执行 ✅（方案 A 核心部分 + 组织架构扩展）

以下 5 张表已补入 Phase 1 Spec：

1. ✅ 新增 `companies` 表（组织顶层：id/name/company_type/contact_info）
2. ✅ 新增 `departments` 表（组织中间层：company_id FK + parent_id 自引用支持多级）
3. ✅ 新增 `roles` 表（id/name/description + department_id FK NOT NULL，角色必须归属部门）
4. ✅ 新增 `external_entities` 表（id/name/description + 可选 company_id/department_id）
5. ✅ 新增 `business_architectures` 表（树形结构 parent_id 自引用）

**当前总表数：17 张**（12 原始 + 5 新增）。

### 待执行（剩余 P0/P1）

4. ⏳ `applications` 表增加 `type` 字段
5. ⏳ 新增 `rules` 表（基础版：id/name/domain/formula/logic，纯存储）

### 方案 B：适度扩展（如需）

在上述基础上再加：

5. `design_artifacts` 表（基础版占位）
6. `roles` 表包含 actions/decisions 的 JSONB 占位（不全做 CRUD，但结构到位）

**新增约 6 张表**，总表数从 12 → ~18。

---

## 六、附录：四类逻辑载体的统一对比

> 来自设计文档 `docs/05-object-lifecycle.md` 和 `docs/04-app-shared-resources.md`

| 载体 | 位置 | 参数来源 | 可调用 API | condition | customAction |
|------|------|---------|-----------|:---------:|:------------:|
| **Rule.logic.data** | Project.rules[] | inputs[] 定义 | 只读 domainModels + utils + rules | ❌ | ✅ |
| **Action.logic.data** | service.actions[] | inputs[] 定义 | 全部 Context API | ❌ | ✅ |
| **Hook.logic.data** | Component.hooks[] | lifeCycles 事件定义 | 全部 + globalActions + holder | ✅ | ✅ |
| **Timer.onTick.data** | Component.timers[] | (holder, context) 固定签名 | 全部 + holder | ❌ | ✅ |

全部都是 `{ userDesc, data }` 格式，data 都是 JS 函数代码。唯一区别是**参数签名来源不同**。
