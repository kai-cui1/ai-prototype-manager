# MCP 接口设计 — 上游（Design AI）与下游（Coding AI）

> **文档编号**：docs/09-mcp-interface
> **状态**：✅ v1.0（上游语义层接口设计完成，下游接口延后）
> **日期**：2026-04-28
> **定位**：定义 Design AI 和 Coding AI 通过 MCP 与本系统交互的接口形态

---

## 1. 接口方向总览

```
┌─────────────────────────────────────────────────────┐
│                   ai-prototype-manager              │
│                                                     │
│   ┌──────────────┐         ┌──────────────┐        │
│   │  上游接口     │         │  下游接口     │        │
│   │  (Design AI) │         │ (Coding AI)  │        │
│   │             │         │              │        │
│   │  ★ 读写接口  │         │  只读查询    │        │
│   │  语义层 CRUD │         │  结构化输出  │        │
│   └──────┬───────┘         └──────┬───────┘        │
│          │                        │                │
│          ▼                        ▼                │
│   ┌──────────────┐         ┌──────────────┐        │
│   │  Design AI   │         │  Coding AI   │        │
│   │  (创建/编辑) │         │  (读取/消费)  │        │
│   └──────────────┘         └──────────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

| 方向 | 角色 | 性质 | 状态 |
|------|------|------|------|
| **上游** | Design AI 通过 MCP 操作原型 | **读写接口** — 语义层实体级 CRUD | ✅ v1.0 设计完成 |
| **下游** | Coding AI 通过 MCP 读取原型 | **只读查询** — 结构化产品规格输出 | ⏭️ 延后至阶段二 |

---

## 2. 设计范围界定

### 2.1 当前阶段：仅语义层

> **核心决策：当前阶段 MCP 接口仅覆盖语义层操作，视觉层操作延后。**

**原因**：
- 本系统的核心定位是「给 AI 用的结构化语义」，不是高保真视觉设计工具
- 视觉层（布局、样式、颜色、间距）委托给外部专业工具（Figma/v0/Cursor）
- 外部设计稿通过 `docs/06-external-design-integration.md` 定义的导入机制映射到语义层

### 2.2 语义层 vs 视觉层边界

```
✅ 语义层（MCP 覆盖）:
├── 领域模型：实体、字段、关系
├── 业务流程：Process、节点、边、Decision
├── 参与者：Role、Service、ExternalEntity 及其 actions/decisions
├── 页面结构：Application、Page、Component 树、zones
├── 交互逻辑：hooks/lifeCycles、数据绑定 binding
└── 业务规则：校验规则、权限注解

❌ 视觉层（不覆盖，委托外部 + 导入）:
├── CSS 样式（颜色、字体、间距、阴影）
├── 像素级布局（绝对位置、宽高）
├── 高保真 HTML 渲染
└── 动画/过渡效果
```

---

## 3. 上游接口：Design AI 语义层 CRUD

> **接口形态：实体级 CRUD。**
> 每个语义实体提供标准的 create/get/update/delete 操作。
> AI 自行组合调用完成复杂任务。

### 3.1 接口总览（8 组）

```
Group 1: Project 管理           — 项目元信息
Group 2: 领域模型 (Domain Model)  — 实体/字段/关系
Group 3: 业务流程 (Business Process) — Process/节点/边/Decision
Group 4: 参与者 (Participants)    — Role/ExternalEntity 及其行为/决策
Group 5: 页面与应用 (Pages & Apps) — Application/Page/Component
Group 6: 交互逻辑 (Interaction)   — Hook/binding
Group 7: 业务规则 (Business Rules) — 校验/权限
Group 8: 查询与分析 (Query)       — 只读分析能力
```

---

### Group 1: Project 管理

| 操作 | 方法 | 参数 | 返回 |
|------|------|------|------|
| 获取项目 | `getProject()` | — | Project 元信息 |
| 更新项目元信息 | `updateProjectMeta(meta)` | `{ name?, description?, goals? }` | 更新后的元信息 |

---

### Group 2: 领域模型 (Domain Model)

#### 实体操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建实体 | `createEntity(def)` | `{ name, displayName, description?, fields[]? }` | 返回 entityId |
| 获取实体 | `getEntity(entityId)` | entityId | 完整实体含字段和关系 |
| 更新实体 | `updateEntity(entityId, updates)` | `{ name?, displayName?, description? }` | — |
| 删除实体 | `deleteEntity(entityId)` | entityId | 检查引用后删除 |

#### 字段操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加字段 | `addField(entityId, fieldDef)` | `{ name, type, required?, ... }` | 返回 fieldId |
| 更新字段 | `updateField(entityId, fieldId, updates)` | 字段属性子集 | — |
| 移除字段 | `removeField(entityId, fieldId)` | — | — |

#### 关系操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加关系 | `addRelation(def)` | `{ fromEntity, toEntity, type, name? }` | 返回 relationId |
| 移除关系 | `removeRelation(relationId)` | — | — |

---

### Group 3: 业务流程 (Business Process)

> **最复杂的组——流程系统是本系统的核心。**

#### Process 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建流程 | `processCreate(def)` | `{ name, displayName, description?, trigger? }` | 返回 processId |
| 获取流程 | `processGet(processId)` | processId | 含 nodeIds/edgeIds/childProcessIds |
| 更新流程 | `processUpdate(processId, updates)` | 属性子集 | — |
| 删除流程 | `processDelete(processId)` | processId | 清理引用 |
| 设置父子 | `processSetParent(processId, parentId?)` | parentId 或 null 解除 | 建立/解除子流程关系 |

#### 节点操作（全局池）

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建活动节点 | `nodeCreateActivity(def)` | `{ name, displayName, holder, actionRef, ... }` | 返回 nodeId |
| 创建判断节点 | `nodeCreateDecision(def)` | `{ name, displayName, holder, decisionRef, ... }` | 返回 nodeId |
| 获取节点 | `nodeGet(nodeId)` | nodeId | 完整节点详情 |
| 更新节点 | `nodeUpdate(nodeId, updates)` | 属性子集 | — |
| 删除节点 | `nodeDelete(nodeId)` | nodeId | 同时清理关联的边 |

#### 边操作（全局池）

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建边 | `edgeCreate(def)` | `{ source: {nodeId, action/branch}, target: {nodeId, action}, payload: { mappings } }` | 返回 edgeId；自动检查唯一性 |
| 获取边 | `edgeGet(edgeId)` | edgeId | 完整边详情含 mappings |
| 更新边映射 | `edgeUpdateMappings(edgeId, mappings)` | `{ [sourceField]: targetField }` | — |
| 删除边 | `edgeDelete(edgeId)` | edgeId | — |

#### DecisionDef 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建决策 | `decisionCreate(participantType, participantId, def)` | `{ name, displayName, branches[]? }` | 返回 decisionId |
| 添加分支 | `decisionAddBranch(decisionId, branchDef)` | `{ name, condition?, outputs[], edgeIds[] }` | — |
| 更新分支 | `decisionUpdateBranch(decisionId, branchName, updates)` | 分支属性子集 | — |
| 移除分支 | `decisionRemoveBranch(decisionId, branchName)` | — | — |

---

### Group 4: 参与者 (Participants)

#### Role 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建角色 | `roleCreate(def)` | `{ name, displayName, description? }` | 返回 roleId |
| 获取角色 | `roleGet(roleId)` | roleId | 含 actions/decisions 完整列表 |
| 更新角色 | `roleUpdate(roleId, updates)` | 属性子集 | — |
| 删除角色 | `roleDelete(roleId)` | roleId | 检查引用后删除 |
| 添加行为 | `roleAddAction(roleId, actionDef)` | `{ id, name, inputs[], outputs[], logic, tool? }` | — |
| 更新行为 | `roleUpdateAction(roleId, actionId, updates)` | Action 属性子集 | — |
| 移除行为 | `roleRemoveAction(roleId, actionId)` | — | — |
| 添加决策 | `roleAddDecision(roleId, decisionDef)` | DecisionDef 结构 | — |

#### ExternalEntity 操作（结构与 Role 对称）

| 操作 | 方法 | 说明 |
|------|------|------|
| 创建外部实体 | `extEntityCreate(def)` | 返回 entityId |
| CRUD | extEntityGet / Update / Delete | 同 Role 模式 |
| 行为/决策 | extEntityAddAction / AddDecision 等 | 同 Role 的 actions/decisions 模式 |

---

### Group 5: 页面与应用 (Pages & Applications)

#### Application 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建应用 | `appCreate(def)` | `{ type, name, displayName, description? }` | 返回 appId |
| 获取应用 | `appGet(appId)` | appId | 含 pages 列表 |
| 更新应用 | `appUpdate(appId, updates)` | 属性子集 | — |

#### Page 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 创建页面 | `pageCreate(appId, def)` | `{ name, displayName, zones[]?, components[]? }` | 返回 pageId |
| 获取页面 | `pageGet(pageId)` | pageId | 含完整组件树 |
| 更新页面 | `pageUpdate(pageId, updates)` | 属性子集 | — |
| 删除页面 | `pageDelete(pageId)` | pageId | — |

#### Component 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加组件 | `componentAdd(parentId, def, position?)` | 组件完整定义 + 可选插入位置 | 返回 compId |
| 更新组件 | `componentUpdate(compId, updates)` | props 子集 | — |
| 移除组件 | `componentRemove(compId)` | compId | 递归移除子组件 |
| 移动组件 | `componentMove(compId, newParentId, position?)` | 移动到新的父节点下 | — |

---

### Group 6: 交互逻辑 (Interaction Logic)

#### Hook 操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加 Hook | `hookAdd(targetId, eventType, hookDef)` | targetId=compId/pageId, eventType, `{ logic: { userDesc, data } }` | 返回 hookId |
| 更新 Hook | `hookUpdate(hookId, updates)` | logic.userDesc / logic.data | — |
| 移除 Hook | `hookRemove(hookId)` | — | — |

#### 数据绑定操作

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 设置绑定 | `bindingSet(compId, fieldPath)` | 如 `"User.name"` | — |
| 移除绑定 | `bindingRemove(compId)` | — | — |

---

### Group 7: 业务规则 (Business Rules)

#### 校验规则

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加校验 | `validationAdd(targetId, ruleDef)` | JSON Schema 风格校验规则 | 返回 ruleId |
| 更新校验 | `validationUpdate(ruleId, updates)` | — | — |
| 移除校验 | `validationRemove(ruleId)` | — | — |

#### 权限注解

| 操作 | 方法 | 参数 | 说明 |
|------|------|------|------|
| 添加权限 | `permissionAdd(targetId, permDef)` | `{ visible?: role[], editable?: role[] }` | 返回 permId |
| 更新权限 | `permissionUpdate(permId, updates)` | — | — |

---

### Group 8: 查询与分析（只读）

> **AI 辅助能力的接口支撑。**

| 操作 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| 完整性检查 | `checkCompleteness(scope?)` | scope = 'all' \| domain \| process \| page | `MissingItem[]` | 扫描完整性框架，返回缺失项列表 |
| 建议下一步 | `suggestNextStep()` | — | `Suggestion` | 基于当前状态建议 PM 下一步 |
| 查询结构 | `queryStructure(type?, id?)` | type='entity'\|'process'\|'page', id? | 结构化数据 | 按类型/ID 查询语义结构 |
| 获取变更历史 | `getChangeHistory(since?)` | since = datetime | `ChangeRecord[]` | 获取最近的变更记录 |
| 流程分析 | `analyzeProcess(processId?)` | processId? | `AnalysisReport` | 流程完整性分析（孤立节点/断链/循环风险等） |

---

## 4. 下游接口（Coding AI）— 延后设计

> **下游接口为只读查询，面向 Coding AI 提供结构化的产品实现规格。**
> 当前阶段延后，以下为预留议题：

### 4.1 预留输出维度

| 维度 | 内容 | 消费者 |
|------|------|--------|
| **前端功能规格** | 页面结构 / 组件清单 / 交互逻辑 / 数据绑定 / 状态管理 | Coding AI / 前端开发 |
| **后端功能规格** | API 接口定义 / 业务流程实现逻辑 / 数据处理 / 权限控制 | Coding AI / 后端开发 |
| **设备交互规格** | 设备协议 / 信号定义 / 控制逻辑 / 异常处理 | 嵌入式 / IoT 开发 |

### 4.2 待设计议题

- [ ] 下游接口的具体 Schema 定义
- [ ] 输出格式选择（JSON / TypeScript Interface / 自定义 DSL）
- [ ] 与上游接口的复用关系（哪些查询方法可共享）
- [ ] 实现对照检查接口（未来能力）

---

## 5. 设计决策汇总

| # | 决策 | 理由 |
|---|------|------|
| MCP-1 | **上游 = 语义层 CRUD，视觉层延后** | 系统核心是语义而非视觉；视觉委托外部工具 |
| MCP-2 | **实体级 CRUD 接口形态** | 简单、透明、易调试；AI 自行组合调用 |
| MCP-3 | **8 组接口按领域分组** | Project / DomainModel / Process / Participant / Page / Interaction / Rule / Query |
| MCP-4 | **下游 = 只读查询，延后设计** | 当前阶段优先完成定义层；下游在编码阶段前设计 |
| MCP-5 | **约 60+ 个方法覆盖语义层** | 完全覆盖所有语义实体的生命周期管理 |
| MCP-6 | **Group 8 查询与分析作为 AI 能力支撑** | checkCompleteness / suggestNextStep / analyzeProcess 等支撑完整性框架驱动问答机制 |
| MCP-7 | **Process 组是最复杂的** | 流程系统是核心，节点/边/Decision/子流程都有独立操作 |
| MCP-8 | **边创建自动检查唯一性** | edgeCreate 内部自动执行 (source,target) 唯一性检查 |

---

## 6. 与 Project JSON 的位置映射

```
Project
├── meta                              ← Group 1: getProject / updateProjectMeta
├── domainModels[]                    ← Group 2: createEntity / addField / addRelation / ...
├── processNodes[]                    ← Group 3: nodeCreateActivity / nodeCreateDecision / ...
├── processEdges[]                    ← Group 3: edgeCreate / edgeUpdateMappings / ...
├── businessProcesses[]               ← Group 3: processCreate / processSetParent / ...
├── roles[]                           ← Group 4: roleCreate / roleAddAction / roleAddDecision / ...
├── externalEntities[]                ← Group 4: extEntityCreate / ...
├── applications[]                    ← Group 5: appCreate / pageCreate / componentAdd / ...
│   └── pages[]
│       └── components[]              ← Group 6: hookAdd / bindingSet / ...
├── rules[]                           ← Group 7: validationAdd / permissionAdd / ...
└── processArchitecture?              ← Group 3: （通过 processSetParent 间接管理）
```

---

## 待后续设计的议题

- [x] ~~**上游接口形态决策**~~ ✅ v1.0 完成（语义层实体级 CRUD，8 组 ~60+ 方法）
- [x] ~~**接口范围界定**~~ ✅ 确定（仅语义层，视觉层延后）
- [ ] **下游接口详细设计** — Coding AI 只读查询 Schema / 输出格式 / 实现对照检查
- [ ] **接口安全与权限** — 谁可以调用什么操作（PM vs AI vs 只读角色）
- [ ] **批量操作优化** — 是否需要 batch API 减少调用次数
- [ ] **变更事件通知** — 上游修改后如何通知下游消费者缓存失效
- [ ] **接口版本管理** — MCP 接口自身的版本演进策略
