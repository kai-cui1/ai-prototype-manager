# 应用管理模块 PRD（续）

> 本文件为 `application-management-prd.md` 的续篇，包含 F-M1-14 应用行为管理。
> 前序文件：`application-management-prd.md`（含 F-M1-11 应用 CRUD）
>
> **S2 范围说明**：本文件只包含业务层内容（业务流程、业务规则、数据规格）。页面布局、交互行为、AI 编码提示等 S3 内容见 `application-management-interaction-2.md`。

---

## 1. F-M1-14 应用行为管理

**优先级**: P1 | **前置依赖**: F-M1-11（应用管理 — 应用必须先存在）

> **核心定位**: 管理 Application 的 `actions[]` 和 `decisions[]` JSONB 字段，为 M3 业务流程模块提供 `actionRef`/`decisionRef` 引用源。M3 的 ActivityNode 通过 `holder.type="service"` + `actionRef` 引用 `Application.actions[].id`，DecisionNode 通过 `decisionRef` 引用 `Application.decisions[].id`。
>
> **数据模型特征**: actions 和 decisions 是 `applications` 表的 JSONB 内嵌数组，非独立表。CRUD 操作采用「读取→校验→变更数组→整体写回」模式，使用应用行级乐观锁防并发覆盖。
>
> **与 F-M1-12/13 的关系**: F-M1-14 与 F-M1-12/13（角色/外部实体行为管理）业务规则完全对称，差异仅在父实体（Application vs Role/ExternalEntity）和 API 路径。共享子类型定义（NodeIO、ToolRef、DecisionBranchDef）和校验逻辑（behavior-common.ts）。
>
> **Action 结构设计决策**: Phase 1 中 Application Action 统一使用 `RoleAction` 类型结构（含 `tool` 字段）。尽管 `business-process.md` 中 `ServiceAction` 理论上无 tool，为最大化代码复用（共享 schema、校验 helper、UI 组件），`tool` 字段保留，service 类型应用可选择不填（null）。

### 1.1 涉及的领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| Application | `applications` | 操作对象 | 更新 `actions` / `decisions` JSONB 字段 |
| Project | `projects` | 父实体（N:1） | 归档时禁止写操作 |

> **领域模型对照**: 在 `docs/02-domain-model/business-process.md` §2 中，ServiceAction 和 DecisionDef 定义为 Application 的内嵌行为清单。本 PRD 的 CRUD 操作直接作用于 `applications.actions` 和 `applications.decisions` JSONB 列，不创建新表。

**ER 关系：**

```
Project (1) ──< (N) Application
                   │
                   ├── actions: JSONB []      ← F-M1-14 管理范围
                   │     └── RoleAction[]（结构同 F-M1-12）
                   │           ├── id, name, displayName, description
                   │           ├── inputs: NodeIO[]
                   │           ├── outputs: NodeIO[]
                   │           ├── logic: { userDesc, data }
                   │           └── tool: ToolRef | null
                   │
                   └── decisions: JSONB []    ← F-M1-14 管理范围
                         └── DecisionDef[]（与 F-M1-12 完全相同）
                               ├── id, name, displayName, description
                               └── branches: DecisionBranchDef[]
                                     ├── name, condition
                                     ├── outputs: NodeIO[]
                                     └── edgeIds: string[]
```

> **共用子类型定义**: NodeIO、ToolRef、ActionLogic、DecisionBranchDef 与 F-M1-12/13 完全共享，定义见 `project-management-prd-2.md` §4.12.1。

### 1.2 业务动作与输入输出

> 本节定义 F-M1-14 涉及的 8 个业务动作序列（actions CRUD 4 个 + decisions CRUD 4 个），与 `project-management-prd-2.md` §4.12.2/§4.13.2 对称。交互层面的细节见 `application-management-interaction-2.md`。

**Action CRUD 业务动作：**

| 步骤 | 业务动作 | 输入 | 输出 | 前置条件 | 异常处理 |
|------|---------|------|------|---------|---------|
| 1 | 查询应用的 actions 数组 | appId | RoleAction[] | 应用存在 | 应用不存在 → 404 |
| 2 | 创建新 Action | appId + Action body | 创建后的 RoleAction（含系统生成 id） | 应用存在 + 项目活跃 + name 唯一 | name 重复 → 409, 项目归档 → 400 |
| 3 | 更新已有 Action | appId + actionId + Action body | 更新后的 RoleAction | 应用存在 + 项目活跃 + Action 存在 + 乐观锁 | 不存在 → 404, name 重复 → 409, 锁冲突 → 409 |
| 4 | 删除已有 Action | appId + actionId | 204 无内容 | 应用存在 + 项目活跃 + Action 存在 + 无流程引用 | 不存在 → 404, 被引用 → 409 |

**Decision CRUD 业务动作：**

| 步骤 | 业务动作 | 输入 | 输出 | 前置条件 | 异常处理 |
|------|---------|------|------|---------|---------|
| 5 | 查询应用的 decisions 数组 | appId | DecisionDef[] | 应用存在 | 应用不存在 → 404 |
| 6 | 创建新 Decision | appId + Decision body | 创建后的 DecisionDef（含系统生成 id） | 应用存在 + 项目活跃 + name 唯一 | name 重复 → 409, 项目归档 → 400 |
| 7 | 更新已有 Decision | appId + decisionId + Decision body | 更新后的 DecisionDef | 应用存在 + 项目活跃 + Decision 存在 + 乐观锁 | 不存在 → 404, name 重复 → 409, 锁冲突 → 409 |
| 8 | 删除已有 Decision | appId + decisionId | 204 无内容 | 应用存在 + 项目活跃 + Decision 存在 + 无流程引用 | 不存在 → 404, 被引用 → 409 |

> **无状态机**: actions/decisions 是无状态值对象，不存在状态流转。

### 1.3 业务规则

> **与 `project-management-prd-2.md` §4.12.3/§4.13.3 的关系**: 本节规则与 §4.12.3/§4.13.3 完全对称，仅将父实体替换为 Application。为完整性和独立可读性，此处列出全部规则。

#### 1.3.1 查询规则

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-167 | 查询 actions/decisions 时，按 JSONB 数组原始顺序返回 | 无额外排序 |
| B-M1-168 | 归档项目的应用 actions/decisions 仍可查询（只读） | 与 G-M1-03 一致 |

#### 1.3.2 创建 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-169 | Action `id` 由系统自动生成（UUID v4），客户端不可指定 | 400 INVALID_INPUT |
| B-M1-170 | Action `name` 格式：`/^[a-zA-Z0-9_-]+$/`，2~50 字符 | 400 INVALID_NAME_FORMAT |
| B-M1-171 | Action `name` 在**同一应用的 actions 数组内**唯一（scope = 单个 application，非整个 project） | 409 NAME_CONFLICT |
| B-M1-172 | Action `displayName` 必填，1~100 字符 | 400 DISPLAY_NAME_REQUIRED |
| B-M1-173 | Action `description` 可选，0~500 字符 | — |
| B-M1-174 | Action `inputs` / `outputs` 为 NodeIO 数组；每项的 `name` 必填且在同一数组内唯一（同数组不重名），`type` 必填（2~50 字符） | 400 INVALID_NODE_IO |
| B-M1-175 | Action `logic.userDesc` 必填，1~2000 字符；`logic.data` 可选，0~10000 字符 | 400 INVALID_LOGIC |
| B-M1-176 | Action `tool` 可选，值为 null 或合法 ToolRef；校验规则同 B-M1-100 | 400 INVALID_TOOL_REF |
| B-M1-177 | 所属应用所在项目必须为 `status='active'` | 400 PROJECT_ARCHIVED |

> **name 唯一性范围说明**: 不同应用可以有同名 action，因此唯一性范围为 application 内部而非 project 全局。

#### 1.3.3 更新 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-178 | Action `id` 不可变更（path param 标识，不随 body 更新） | — |
| B-M1-179 | Action `name` 格式/唯一性同创建，唯一性排除自身 | 400 / 409 |
| B-M1-180 | 其余字段校验规则同创建（B-M1-172~176） | 同创建 |
| B-M1-181 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-182 | 应用 version 乐观锁校验（JSONB 整体写回需防并发覆盖，每次变更递增 application.version） | 409 VERSION_CONFLICT |

#### 1.3.4 删除 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-183 | 删除 action 时检查 `process_nodes` 表是否存在 `holder_type='service' AND holder_id=appId` 且 `action_ref` 引用了此 actionId 的节点；存在则拒绝删除 | 409 ACTION_IN_USE |
| B-M1-184 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-185 | Action 不存在（actionId 在数组中未找到） | 404 ACTION_NOT_FOUND |

> **B-M1-183 Phase 1 预留说明**: 同 B-M1-107，若 Phase 1 中 `process_nodes` 表尚无 `action_ref` 字段，则引用检查暂时跳过，在代码中加 `TODO` 注释标注 M3 实现后需启用此检查。

#### 1.3.5 创建 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-186 | Decision `id` 由系统自动生成（UUID v4），客户端不可指定 | 400 INVALID_INPUT |
| B-M1-187 | Decision `name` 格式：同 Action name 规则（B-M1-170） | 400 INVALID_NAME_FORMAT |
| B-M1-188 | Decision `name` 在**同一应用的 decisions 数组内**唯一 | 409 NAME_CONFLICT |
| B-M1-189 | Decision `displayName` 必填，1~100 字符 | 400 DISPLAY_NAME_REQUIRED |
| B-M1-190 | Decision `description` 可选，0~500 字符 | — |
| B-M1-191 | Decision `branches` 必填，至少包含 **2 个分支** | 400 INVALID_BRANCHES |
| B-M1-192 | DecisionBranch `name` 必填，同一 Decision 内 branches 不可重名 | 400 INVALID_BRANCH |
| B-M1-193 | DecisionBranch `condition` 可选，为字符串表达式（Phase 1 不做语法校验，仅存储原始字符串） | — |
| B-M1-194 | DecisionBranch `outputs` 为 NodeIO 数组，校验规则同 B-M1-174 | 400 INVALID_NODE_IO |
| B-M1-195 | DecisionBranch `edgeIds` Phase 1 必须为空数组 `[]`（M3 业务流程模块负责填充边 ID） | 400 INVALID_EDGE_IDS |
| B-M1-196 | 所属应用所在项目必须为 `status='active'` | 400 PROJECT_ARCHIVED |

#### 1.3.6 更新 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-197 | Decision `id` 不可变更 | — |
| B-M1-198 | Decision `name` 格式/唯一性同创建，排除自身 | 400 / 409 |
| B-M1-199 | 其余字段校验规则同创建（B-M1-189~195） | 同创建 |
| B-M1-200 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-201 | 应用 version 乐观锁校验 | 409 VERSION_CONFLICT |

#### 1.3.7 删除 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-202 | 删除 decision 时检查 `process_nodes` 表是否存在引用了此 decisionId 的 Decision 节点；存在则拒绝删除 | 409 DECISION_IN_USE |
| B-M1-203 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-204 | Decision 不存在 | 404 DECISION_NOT_FOUND |

> **B-M1-202 Phase 1 预留说明**: 同 B-M1-126。

#### 1.3.8 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-170/187: name 正则 | 创建/更新 Action/Decision |
| 唯一性校验 | B-M1-171/179/188/198: 应用范围内唯一（排除自身） | 创建/更新前 |
| 必填校验 | B-M1-172/189: displayName 必填 | 创建/更新 |
| NodeIO 校验 | B-M1-174/194: inputs/outputs 中 name+type 必填且不重名 | 创建/更新 |
| Branch 校验 | B-M1-191~195: 最少 2 分支 + 分支名唯一 + edgeIds=[] | 创建/更新 Decision |
| Tool 校验 | B-M1-176: ToolRef 格式校验 | 创建/更新 Action |
| 状态校验 | B-M1-177/181/184/196/200/203: 项目活跃 | 所有写操作 |
| 引用完整性 | B-M1-183/202: 被 process_nodes 引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-182/201: application version 匹配 | 更新时 |

#### 1.3.9 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 说明 |
|------|-----------|--------|------|
| Action name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 正则不匹配或长度越界 |
| Action name 同应用内冲突 | 409 | `NAME_CONFLICT` | 同 application 的 actions 数组内已存在 |
| Action displayName 为空 | 400 | `DISPLAY_NAME_REQUIRED` | 必填字段缺失 |
| NodeIO name 缺失或重复 | 400 | `INVALID_NODE_IO` | 同数组内 name 不唯一 |
| ToolRef 格式非法 | 400 | `INVALID_TOOL_REF` | 非法枚举值或对象结构不完整 |
| Logic userDesc 缺失 | 400 | `INVALID_LOGIC` | 必填字段缺失 |
| Branch 数量 < 2 | 400 | `INVALID_BRANCHES` | Decision 至少需要 2 个分支 |
| Branch name 重复 | 400 | `INVALID_BRANCH` | 同 Decision 内分支名冲突 |
| edgeIds 非空（Phase 1） | 400 | `INVALID_EDGE_IDS` | Phase 1 不允许非空 edgeIds |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | 归档项目禁止写操作 |
| Action/Decision 被流程节点引用 | 409 | `ACTION_IN_USE` / `DECISION_IN_USE` | 需先解除引用 |
| Action/Decision 不存在 | 404 | `ACTION_NOT_FOUND` / `DECISION_NOT_FOUND` | 数组中未找到指定 id |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | 并发修改冲突 |

### 1.4 数据规格

> **与 `project-management-prd-2.md` §4.12.4/§4.13.4 的关系**: 输入输出数据规格与 §4.12.4/§4.13.4 完全相同，此处仅列出 API 路径差异。NodeIO 子类型、DecisionBranchInput 等子结构不再重复定义。

#### Action CRUD

**List Actions（GET /api/v1/projects/:projectId/applications/:appId/actions）**

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data.items | RoleAction[] | applications.actions JSONB | 按数组原序返回，无分页 |
| data.version | integer | applications.version | 应用当前版本号（供后续写操作乐观锁使用） |

**Create Action（POST /api/v1/projects/:projectId/applications/:appId/actions）**

输入/输出：与 `project-management-prd-2.md` §4.12.4 Create Action 完全相同（字段名、类型、校验规则一致）。

**Update Action（PUT /api/v1/projects/:projectId/applications/:appId/actions/:actionId）**

输入/输出：与 `project-management-prd-2.md` §4.12.4 Update Action 完全相同。

**Delete Action（DELETE /api/v1/projects/:projectId/applications/:appId/actions/:actionId）**

- 请求：无 body，actionId 在 URL path 中
- 响应：204 No Content（成功）/ 错误码

#### Decision CRUD

**List Decisions（GET /api/v1/projects/:projectId/applications/:appId/decisions）**

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data.items | DecisionDef[] | applications.decisions JSONB | 按数组原序返回，无分页 |
| data.version | integer | applications.version | 应用当前版本号 |

**Create Decision（POST /api/v1/projects/:projectId/applications/:appId/decisions）**

输入/输出：与 `project-management-prd-2.md` §4.12.4 Create Decision 完全相同。

**Update Decision（PUT /api/v1/projects/:projectId/applications/:appId/decisions/:decisionId）**

输入/输出：与 `project-management-prd-2.md` §4.12.4 Update Decision 完全相同。

**Delete Decision（DELETE /api/v1/projects/:projectId/applications/:appId/decisions/:decisionId）**

- 请求：无 body，decisionId 在 URL path 中
- 响应：204 No Content（成功）/ 错误码

### 1.5 AI 编码提示

- **JSONB 原子写回**: 同 `project-management-prd-2.md` §4.12.5，使用应用行级乐观锁（application.version）防止并发覆盖。不可使用 `jsonb_set` 单项更新
- **id 生成策略**: 同 §4.12.5，actionId/decisionId 由后端 `crypto.randomUUID()` 生成
- **process_nodes 引用检查**: 删除 action/decision 时需查 `process_nodes` 表中 `holder_type='service' AND holder_id=appId` 的行。Phase 1 同样加 `// TODO: M3 实现后启用 process_nodes 引用检查` 注释标注
- **edgeIds=[] Phase 1 硬约束**: 同 §4.12.5
- **与 F-M1-12/13 的代码复用**: 校验逻辑复用 `behavior-common.ts`；前端 ActionFormDialog / DecisionFormDialog / NodeIOEditor 组件已抽取为共享组件，三个详情页共同引用
- **Service 独立文件**: `application-behavior.service.ts` 与 `role-behavior.service.ts` / `external-entity-behavior.service.ts` 结构镜像但各自独立，便于未来独立演进
