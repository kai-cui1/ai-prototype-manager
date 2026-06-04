# 项目管理模块 PRD（续）

> 本文件为 `project-management-prd.md` 的续篇，包含 F-M1-05 ~ F-M1-12、§5 跨功能规则、§6 验收标准。
> 前序文件：`project-management-prd.md`（含 §1~§4.4）
>
> **S2 范围说明**：本文件只包含业务层内容（业务流程、业务规则、数据规格）。页面布局、交互行为、AI 编码提示等 S3 内容见 `project-management-interaction.md`。
>
> **F-M1-11 说明**：应用管理 PRD 详见独立文档 `docs/03-prd-ux/modules/application-management/application-management-prd.md`，本文件仅引用。

---

### 4.5 F-M1-05 归档 / 恢复项目

**优先级**: P0 | **前置依赖**: F-M1-03（查看项目详情）

#### 4.5.1 涉及领域模型

| 实体 | 表名 | 说明 |
|------|------|------|
| Project | `projects` | 单实体操作, 仅更新 `status` 字段 |

**归档行为对子数据的影响（已确认的设计决策）：**

| 子数据类型 | 归档操作影响 | 查询时的过滤方式 |
|-----------|------------|---------------|
| 领域实体 (`domain_entities`) | **不修改** | `JOIN projects ON ... WHERE projects.status = 'active'` |
| 业务流程 (`business_processes`) | **不修改** | 同上 |
| 公司 (`companies`) | **不修改** | 同上 |
| 部门 (`departments`) | **不修改** | 同上 |
| 角色 (`roles`) | **不修改** | 同上 |
| 外部实体 (`external_entities`) | **不修改** | 同上 |

> **设计决策依据**: 归档是标记操作（`status='archived'`）, 不级联修改子数据. 所有列表查询通过 JOIN `projects.status` 自动过滤归档项目的子数据.

#### 4.5.2 业务规则

##### 4.5.2.1 更新（Update — 状态变更）

**状态转换矩阵：**

| 当前状态 | 目标状态 | 允许？ | 说明 |
|---------|---------|:------:|------|
| `active` | `archived` | ✅ | 归档操作 |
| `archived` | `active` | ✅ | 恢复操作 |
| `active` | `active` | ❌ | 无意义, 返回 400 |
| `archived` | `archived` | ❌ | 无意义, 返回 400 |

**业务规则清单：**

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-23 | 状态变更必须携带当前 `version` 值用于乐观锁校验, 缺失返回 400 | 前端必须从详情数据中携带 version |
| B-M1-24 | 不允许相同状态重复设置（active→active 或 archived→archived）, 返回 400 | 前端应控制按钮显隐避免此场景 |
| B-M1-25 | 归档/恢复仅修改 `projects.status`, **不级联修改任何子表数据**, 返回成功即完成 | 这是核心设计决策, 参见 4.5.1 |

##### 4.5.2.2 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 乐观锁 | B-M1-23: version 必须匹配 | 后端 UPDATE 前 |
| 状态合法性 | B-M1-24: 不允许同状态重复设置 | 后端接收时 |
| 级联约束 | B-M1-25: 标记操作, 不动子数据 | 后端 UPDATE 时（仅改 status 字段） |

##### 4.5.2.3 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| version 缺失或不合法 | 400 | `INVALID_VERSION` | 刷新页面获取最新数据 |
| 相同状态重复设置 | 400 | `INVALID_STATUS_TRANSITION` | 不应出现（前端按钮控制）, 兜底 Toast 提示 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | Toast 提示, 刷新页面 |

#### 4.5.3 数据规格

**输入数据（PATCH /api/v1/projects/:id/status Request Body）：**

| 字段 | 类型 | 必填 | 可选值 | 说明 |
|------|------|:----:|--------|------|
| status | string | ✅ | `archived` / `active` | 目标状态 |
| version | integer | ✅ | — | 当前版本号（乐观锁） |

**输出数据（Response Body）：**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| id | string | projects.id | 项目 UUID |
| status | string | projects.status | 更新后的状态（archived / active） |
| version | integer | projects.version | 递增后的版本号 |
| updated_at | string | projects.updated_at | 状态变更时间 (ISO 8601) |

---

### 4.6 F-M1-06 公司管理

**优先级**: P0 | **前置依赖**: F-M1-02（创建项目 — 公司隶属于某个项目）

#### 4.6.1 涉及领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| Company | `companies` | 属于 Project（N:1） | 业务参与方组织, 如"国家电网"、"特斯拉" |
| Project | `projects` | 被 Company 引用（1:N） | 公司所属的项目容器 |

**ER 关系：**

```
Project (1) ──< (N) Company
   │                │
   │ id (PK)         │ project_id (FK)
   │                 │ id (PK)
   │                 │ name (唯一性范围: 同一 project 内)
   │                 │ display_name
   │                 │ description
```

#### 4.6.2 业务规则

##### 4.6.2.1 查询（Query）

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-26 | 公司列表按 `created_at DESC` 排序（最新创建在前） | 默认排序规则 |
| B-M1-27 | 搜索支持 `name` 和 `display_name` 双字段模糊匹配（ILIKE） | 使用 OR 条件连接两个字段 |
| B-M1-28 | 归档项目的公司列表仍然可以查看（只读）, 但隐藏新建/编辑/删除按钮 | 通过 project.status 判断 |

##### 4.6.2.2 创建（Create）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-29 | `name` 格式: `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 | 400 INVALID_FORMAT |
| B-M1-30 | `name` 在**同一 project_id 范围内**唯一（非全局唯一） | 409 NAME_CONFLICT |
| B-M1-31 | `display_name` 必填, 1~100 字符 | 400 REQUIRED |
| B-M1-32 | `description` 可选, 0~2000 字符 | — |
| B-M1-33 | 所属项目必须是 `status='active'` | 400 PROJECT_ARCHIVED |

##### 4.6.2.3 更新（Update）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-34 | `name` 格式和长度同创建规则（B-M1-29/30）, 唯一性校验排除自身 ID | 400 / 409 |
| B-M1-35 | `display_name` 同创建规则（B-M1-31） | 400 |
| B-M1-36 | 所属项目必须为活跃状态 | 400 PROJECT_ARCHIVED |
| B-M1-37 | 乐观锁: Request Body 携带 currentVersion, SQL 带 `WHERE version = :version` | 409 VERSION_CONFLICT |

##### 4.6.2.4 删除（Delete）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-38 | 删除公司前检查是否存在引用该 company_id 的 `domain_entity` 或 `business_process` | 存在则返回 409 ENTITY_IN_USE, 附引用清单 |
| B-M1-39 | 删除公司时**级联删除**其下属的所有 `departments`（部门）, 并**软解绑**关联的 `roles`（department_id SET NULL） | 先 CASCADE 删 departments（触发 roles.department_id SET NULL）→ 最后删 company |
| B-M1-40 | 归档项目不允许删除公司 | 400 PROJECT_ARCHIVED |

##### 4.6.2.5 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-29: name 正则 | 创建/更新时 |
| 唯一性校验 | B-M1-30/34: project_id 范围内唯一 | 创建/更新前 |
| 必填校验 | B-M1-31: display_name 必填 | 创建/更新时 |
| 长度校验 | B-M1-29/31/32: 各字段长度限制 | 创建/更新时 |
| 状态校验 | B-M1-33/36/40: 项目必须活跃 | 创建/更新/删除时 |
| 引用完整性 | B-M1-38: 被领域实体/流程引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-37: version 匹配 | 更新时 |

##### 4.6.2.6 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 输入框红字提示 |
| name 已存在（同项目） | 409 | `NAME_CONFLICT` | 输入框红字提示 |
| display_name 为空 | 400 | `DISPLAY_NAME_REQUIRED` | 输入框红字提示 |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | Toast 提示, 隐藏操作按钮 |
| 公司被引用无法删除 | 409 | `ENTITY_IN_USE` | 弹窗展示引用清单 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | Toast 提示, 刷新 |

#### 4.6.3 数据规格

**输入数据（POST /api/v1/projects/:id/companies Request Body）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|:------:|------|
| name | string | ✅ | — | 编程标识符, 正则 `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 |
| display_name | string | ✅ | — | 显示名称, 1~100 字符 |
| description | string | ❌ | null | 描述, 0~2000 字符 |

**输入数据（PUT /api/v1/companies/:id Request Body）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|:------:|------|
| name | string | ✅ | — | 同创建 |
| display_name | string | ✅ | — | 同创建 |
| description | string | ❌ | null | 同创建 |
| version | integer | ✅ | — | 当前版本号（乐观锁） |

**输出数据（Company Response Body）：**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| id | string | companies.id | 公司 UUID |
| project_id | string | companies.project_id | 所属项目 ID |
| name | string | companies.name | 编程标识符 |
| display_name | string | companies.display_name | 显示名称 |
| description | string \| null | companies.description | 描述 |
| department_count | integer | COUNT(departments WHERE company_id) | 关联部门数（虚拟字段） |
| role_count | integer | COUNT(roles WHERE department_id IN 该公司下所有 departments.id) | 挂载到该公司下属部门的角色数（虚拟字段） |
| status | string | companies.status | active / archived |
| version | integer | companies.version | 版本号 |
| created_at | string | companies.created_at | 创建时间 |
| updated_at | string | companies.updated_at | 更新时间 |

**输出数据（列表 Response）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| data | Company[] | 公司列表数组 |
| meta.total | integer | 总数（用于分页） |
| meta.page | integer | 当前页码 |
| meta.pageSize | integer | 每页条数 |

---

### 4.7 F-M1-07 部门管理

**优先级**: P0 | **前置依赖**: F-M1-06（公司管理 — 部门隶属于公司）

#### 4.7.1 涉及领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| Department | `departments` | 属于 Company（N:1）, 支持自引用多级（parent_id）, 间接属于 Project | 公司下的组织单元, 如"研发部"、"市场部", 支持"研发部→前端组→React 小组" |
| Company | `companies` | 被 Department 引用（1:N） | 部门所属的公司 |
| Project | `projects` | 通过 Company 间接关联 | 顶级容器 |

> **领域模型对照**: 领域模型文档（`docs/02-domain-model/domain-model.md` §2.4）已定义 Department 完整实体, 含 parentId 自引用多级嵌套、companyId FK、可选挂载 Role 等字段. 它是 M1 项目管理模块的**组织架构建模对象**, 用于描述被建模产品的业务参与方结构, 非系统组织. 与 Role 类似, 2C 项目可能不需要 Department.

**ER 关系：**

```
Project (1) ──< (N) Company (1) ──< (N) Department
   │                │                     │
   │ id              │ id (PK)             │ id (PK)
   │                 │ project_id (FK)     │ project_id (FK)
   │                 │                     │ company_id (FK → companies.id)
   │                 │ name（唯一性范围: 同一 company_id 内）│ parent_id (FK → departments.id, nullable, 自引用)
   │                 │ display_name        │   ← 支持多级部门
   │                 │ description         │ display_name
   │                 │                     │ description
```

> **多级部门**: DB Schema 已定义 `parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL` + 索引 + 注释"支持多级部门".

#### 4.7.2 业务规则

##### 4.7.2.1 查询（Query）

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-41 | 部门列表按 `created_at DESC` 排序 | 默认排序 |
| B-M1-42 | 搜索支持 `name` 和 `display_name` ILIKE 模糊匹配 | 双字段 OR 条件 |
| B-M1-43 | 归档项目下的部门只读, 隐藏写操作按钮 | 通过 project.status 级联判断 |

##### 4.7.2.2 创建（Create）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-44 | `name` 格式: `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 | 400 INVALID_FORMAT |
| B-M1-45 | `name` 在**同一 company_id 范围内**唯一 | 409 NAME_CONFLICT |
| B-M1-46 | `display_name` 必填, 1~100 字符 | 400 REQUIRED |
| B-M1-47 | `description` 可选, 0~2000 字符 | — |
| B-M1-48 | 所属公司所在项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-48b | `parent_id` 可选, 若提供必须引用**同公司下已存在的** department id; 不允许引用自身（新建时不可能但防御性校验） | 400 INVALID_PARENT |

##### 4.7.2.3 更新（Update）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-49 | `name` 格式/长度/唯一性（同 company_id 范围, 排除自身） | 400 / 409 |
| B-M1-50 | `display_name` 必填 1~100 | 400 |
| B-M1-51 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-52 | 乐观锁 version 校验 | 409 VERSION_CONFLICT |
| B-M1-52b | `parent_id` 变更时禁止循环引用（不能选自身或自身后代节点为父） | 400 CIRCULAR_REFERENCE |

##### 4.7.2.4 删除（Delete）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-53 | 删除前检查是否被 `domain_entity` / `business_process` 引用 | 409 ENTITY_IN_USE |
| B-M1-54 | 删除部门时**软解绑**关联的 `roles`（department_id SET NULL）, **级联删除**子部门（ON DELETE CASCADE） | roles 变为独立角色, 子部门递归删除 |
| B-M1-55 | 归档项目不允许删除 | 400 PROJECT_ARCHIVED |

> **B-M1-54 变更说明**: 原设计为"级联删除 roles", 变更为"SET NULL 解绑". 原因：Role 已改为可独立存在（见 `role-independence-design.md`）, 删除组织不应销毁角色本身. 子部门仍使用 CASCADE 删除（部门间的父子是强拥有关系）.

##### 4.7.2.5 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-44: name 正则 | 创建/更新 |
| 唯一性校验 | B-M1-45/49: company_id 范围内唯一 | 创建/更新前 |
| 必填校验 | B-M1-46/50: display_name 必填 | 创建/更新 |
| 状态校验 | B-M1-48/51/55: 项目活跃 | 创建/更新/删除 |
| 层级校验 | B-M1-48b/52b: parent_id 合法性 + 无循环引用 | 创建/更新时 |
| 引用完整性 | B-M1-53: 被引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-52: version 匹配 | 更新时 |

##### 4.7.2.6 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 输入框红字 |
| name 已存在（同公司） | 409 | `NAME_CONFLICT` | 输入框红字 |
| display_name 为空 | 400 | `DISPLAY_NAME_REQUIRED` | 输入框红字 |
| parent_id 无效（不存在/跨公司） | 400 | `INVALID_PARENT` | 下拉选择器红字提示 |
| parent_id 循环引用 | 400 | `CIRCULAR_REFERENCE` | Toast 提示, 不允许保存 |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | Toast |
| 部门被引用无法删除 | 409 | `ENTITY_IN_USE` | 弹窗展示引用清单 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | Toast + 刷新 |

#### 4.7.3 数据规格

**输入数据（POST /api/v1/companies/:id/departments Request Body）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|:------:|------|
| name | string | ✅ | — | 编程标识符, 正则 `/^[a-zA-Z0-9_-]+$/`, 2~50 |
| display_name | string | ✅ | — | 显示名称, 1~100 字符 |
| description | string | ❌ | null | 描述, 0~2000 字符 |
| parent_id | string | ❌ | null | 父部门 ID; 为 null 或不传 = 顶级部门 |

**输入数据（PUT /api/v1/departments/:id Request Body）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| name | string | ✅ | 同创建 |
| display_name | string | ✅ | 同创建 |
| description | string | ❌ | 同创建 |
| parent_id | string | ❌ | 可更改父部门（需通过循环引用检测） |
| version | integer | ✅ | 乐观锁版本号 |

**输出数据（Department Response Body）：**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| id | string | departments.id | 部门 UUID |
| project_id | string | departments.project_id | 所属项目 ID |
| company_id | string | departments.company_id | 所属公司 ID |
| parent_id | string \| null | departments.parent_id | 父部门 ID（null = 顶级部门） |
| parent_name | string \| null | 父部门 display_name | 父部门显示名（虚拟字段） |
| name | string | departments.name | 编程标识符 |
| display_name | string | departments.display_name | 显示名称 |
| description | string \| null | departments.description | 描述 |
| role_count | integer | COUNT(roles WHERE department_id) | 已挂载角色数（虚拟字段） |
| children_count | integer | COUNT(departments WHERE parent_id) | 子部门数（虚拟字段） |
| level | integer | 递归计算层级深度 | 根级别=1, 每层+1（虚拟字段, 用于 UI 缩进） |
| status | string | departments.status | active / archived |
| version | integer | departments.version | 版本号 |
| created_at | string | departments.created_at | 创建时间 |
| updated_at | string | departments.updated_at | 更新时间 |

> **列表查询返回树形结构**: GET 接口支持 `?tree=true` 参数, 返回嵌套的树形 JSON（children 数组）, 前端直接用于树形组件渲染. 不带此参数时返回 flat 列表 + parent_id 字段.

---

### 4.8 F-M1-08 角色管理

**优先级**: P0 | **前置依赖**: F-M1-02（创建项目 — 角色直接隶属于项目）

> **设计决策依据**: 见 `docs/01-design-idea/role-independence-design.md`
> **核心变更**: Role 从「部门的叶子节点」变为「Project 级别的参与者」，department_id 改为可选挂载（nullable）。
> 原因：2C 项目（如社交 App、电商 C 端）没有公司/部门概念，但业务流程中仍需角色定义。

#### 4.8.1 涉及领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| Role | `roles` | 直接属于 Project（N:1），**可选**挂载到 Department | 业务流程参与者，如"产品经理"、"注册用户"、"VIP 客户" |
| Department | `departments` | 可被 Role 引用（0:N） | 可选的组织归属点 |
| Company | `companies` | 通过 Department 间接关联 | 间接父实体（仅对已挂载的角色有意义） |
| Project | `projects` | 直接父实体（所有角色的顶级容器） | — |

> **领域模型对照**: 在 `docs/02-domain-model/domain-model.md` **§2.6** 中，Role 定义为直接关联 N:1 → Project（`roles[]` 在 Project 根级），`departmentId` 为可选字段。本 PRD 的 DB 层 `department_id` 是**可选的组织挂载点**，不是强制归属。详见 `role-independence-design.md`。

**ER 关系：**

```
Project (1) ──< (N) Role [全部角色]
                  │
                  ├── department_id IS NULL ──→ 独立角色（2C 场景等）
                  │
                  └── department_id IS NOT NULL ──→ 组织角色（挂载到部门）

roles 表关键字段:
├── id (PK)
├── project_id (FK → projects.id)
├── department_id (FK → departments.id, nullable)  ← 可选挂载
├── name（唯一性范围: 同一 project_id 内全局唯一）
├── display_name
└── description
```

#### 4.8.2 业务规则

##### 4.8.2.1 查询（Query）

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-56 | 角色列表按 `created_at DESC` 排序 | 默认排序 |
| B-M1-57 | 搜索支持 `name` / `display_name` ILIKE | 双字段模糊匹配 |
| B-M1-58 | 支持按 `department_id` 筛选（含 null 值筛选"独立角色"） | 额外筛选维度 |
| B-M1-58b | 归档项目下角色只读, 隐藏写操作按钮 | 通过 project.status 判断 |

##### 4.8.2.2 创建（Create）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-59 | `name` 格式: `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 | 400 INVALID_FORMAT |
| B-M1-60 | `name` 在**同一 project_id 范围内全局唯一**（不区分是否挂载部门） | 409 NAME_CONFLICT |
| B-M1-61 | `display_name` 必填, 1~100 字符 | 400 REQUIRED |
| B-M1-62 | `description` 可选, 0~2000 字符 | — |
| B-M1-63 | `department_id` 可选, 若提供必须引用**本项目内存在的、活跃项目下的** department id | 400 INVALID_DEPARTMENT |
| B-M1-63b | 所属项目必须为 `status='active'` | 400 PROJECT_ARCHIVED |

> **唯一性变更说明**: 原 design 为"同 dept_id 内唯一", 变更为"同 project_id 内全局唯一". 原因：独立角色(department_id=null)和挂载角色共享同一个命名空间, 避免同名混淆.

##### 4.8.2.3 更新（Update）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-64 | `name` 格式/唯一性（同 project_id, 排除自身） | 400 / 409 |
| B-M1-65 | `display_name` 必填 1~100 | 400 |
| B-M1-66 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-67 | 乐观锁 version 校验 | 409 VERSION_CONFLICT |
| B-M1-67b | `department_id` 变更规则同创建（B-M1-63）, 允许从有值改为 null（取消挂载）或从 null 改为有值（新增挂载） | 400 INVALID_DEPARTMENT |

##### 4.8.2.4 删除（Delete）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-68 | 删除前检查被 `domain_entity` / `business_process` 引用 | 409 ENTITY_IN_USE |
| B-M1-69 | 角色无子实体, 直接 DELETE, 无级联 | — |
| B-M1-70 | 归档项目不允许删除 | 400 PROJECT_ARCHIVED |

> **注意**: 删除角色不影响任何 Company 或 Department（与旧设计不同）. role.department_id 是外键指向 departments, 删除 role 时只是删除外键来源端.

##### 4.8.2.5 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-59: name 正则 | 创建/更新 |
| 唯一性校验 | B-M1-60/64: project_id 范围内全局唯一 | 创建/更新前 |
| 必填校验 | B-M1-61/65: display_name 必填 | 创建/更新 |
| 挂载校验 | B-M1-63/67b: department_id 合法性（可选但需有效） | 创建/更新 |
| 状态校验 | B-M1-63b/66/70: 项目活跃 | 创建/更新/删除 |
| 引用完整性 | B-M1-68: 被引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-67: version 匹配 | 更新时 |

##### 4.8.2.6 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 输入框红字 |
| name 已存在（同项目） | 409 | `NAME_CONFLICT` | 输入框红字 |
| display_name 为空 | 400 | `DISPLAY_NAME_REQUIRED` | 输入框红字 |
| department_id 无效 | 400 | `INVALID_DEPARTMENT` | 下拉选择器红字提示 |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | Toast |
| 角色被引用无法删除 | 409 | `ENTITY_IN_USE` | 弹窗展示引用清单 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | Toast + 刷新 |

#### 4.8.3 数据规格

**输入数据（POST /api/v1/projects/:projectId/roles Request Body）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|:------:|------|
| name | string | ✅ | — | 编程标识符, 正则 `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 |
| display_name | string | ✅ | — | 显示名称, 1~100 字符 |
| description | string | ❌ | null | 描述, 0~2000 字符 |
| department_id | string | ❌ | null | 可选挂载目标部门 ID, 为 null 或不传 = 独立角色 |

**输入数据（PUT /api/v1/roles/:id Request Body）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| name | string | ✅ | 同创建 |
| display_name | string | ✅ | 同创建 |
| description | string | ❌ | 同创建 |
| department_id | string | ❌ | 可选挂载, 允许修改（可从有值改为 null 或反向） |
| version | integer | ✅ | 乐观锁版本号 |

**输出数据（Role Response Body）：**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| id | string | roles.id | 角色 UUID |
| project_id | string | roles.project_id | 所属项目 ID |
| department_id | string \| null | roles.department_id | 所属部门 ID（null = 独立角色） |
| department_name | string \| null | departments.display_name | 所属部门显示名（虚拟字段, null 时为空串） |
| name | string | roles.name | 编程标识符 |
| display_name | string | roles.display_name | 显示名称 |
| description | string \| null | roles.description | 描述 |
| category | string \| null | roles.category | 角色分类标签 |
| contact_info | object | roles.contact_info | 联系方式 JSON |
| status | string | roles.status | active / archived |
| version | integer | roles.version | 版本号 |
| created_at | string | roles.created_at | 创建时间 |
| updated_at | string | roles.updated_at | 更新时间 |

**输出数据（列表 Response）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| data | Role[] | 角色列表数组 |
| meta.total | integer | 总数（用于分页） |
| meta.page | integer | 当前页码 |
| meta.pageSize | integer | 每页条数 |

**列表查询参数（GET /api/v1/projects/:projectId/roles）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| page | integer | ❌ | 页码, 默认 1 |
| pageSize | integer | ❌ | 每页条数, 默认 20 |
| search | string | ❌ | 搜索关键词（name/display_name ILIKE） |
| departmentId | string \| `__none__` | ❌ | 部门筛选; 不传=全部, `__none__`=独立角色, 传 id=某部门 |

---

### 4.9 F-M1-09 外部实体管理

**优先级**: P1 | **前置依赖**: F-M1-02（创建项目 — 外部实体直接隶属于项目）

#### 4.9.1 涉及领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| ExternalEntity | `external_entities` | 直接属于 Project（N:1） | 项目外的业务参与方, 如"政府监管机构"、"最终用户" |
| Project | `projects` | 被 ExternalEntity 引用（1:N） | 顶级容器 |

**ER 关系：**

```
Project (1) ──< (N) ExternalEntity
   │                │
   │ id (PK)         │ id (PK)
   │                 │ project_id (FK)
   │                 │ name（唯一性: 同一 project_id 内）
   │                 │ display_name
   │                 │ type（分类枚举）
   │                 │ description
```

> **外部实体 vs 公司/部门的区别**: 公司和部门是**建模对象内部的**组织架构（属于被建模产品的业务参与方）, 外部实体是**与被建模产品交互的外部系统或角色**. 例如建模"换电站管理系统"时, "国家电网"是公司（内部组织）, "政府监管部门"是外部实体.

#### 4.9.2 业务规则

##### 4.9.2.1 查询（Query）

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-71 | 列表按 `created_at DESC` 排序 | 默认排序 |
| B-M1-72 | 搜索支持 name / display_name ILIKE | 双字段模糊匹配 |
| B-M1-73 | 支持按 `type` 筛选（下拉筛选器） | 额外筛选维度 |

##### 4.9.2.2 创建（Create）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-74 | `name` 格式: `/^[a-zA-Z0-9_-]+$/`, 2~50 字符 | 400 INVALID_FORMAT |
| B-M1-75 | `name` 在同一 project_id 内唯一 | 409 NAME_CONFLICT |
| B-M1-76 | `display_name` 必填, 1~100 字符 | 400 REQUIRED |
| B-M1-77 | `type` 必填, 值必须在允许的枚举列表内 | 400 INVALID_ENUM |
| B-M1-78 | `description` 可选, 0~2000 | — |
| B-M1-79 | 项目必须活跃 | 400 PROJECT_ARCHIVED |

##### 4.9.2.3 更新（Update）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-80 | name 格式/唯一性（同 project_id, 排除自身） | 400 / 409 |
| B-M1-81 | display_name 必填 1~100 | 400 |
| B-M1-82 | type 必须是合法枚举值 | 400 INVALID_ENUM |
| B-M1-83 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-84 | 乐观锁 version 校验 | 409 VERSION_CONFLICT |

##### 4.9.2.4 删除（Delete）

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-85 | 删除前检查被 domain_entity / business_process 引用 | 409 ENTITY_IN_USE |
| B-M1-86 | 外部实体无子实体, 直接 DELETE | — |
| B-M1-87 | 归档项目不允许删除 | 400 PROJECT_ARCHIVED |

##### 4.9.2.5 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-74: name 正则 | 创建/更新 |
| 唯一性校验 | B-M1-75/80: project_id 范围内唯一 | 创建/更新前 |
| 必填校验 | B-M1-76/81: display_name 必填 | 创建/更新 |
| 枚举校验 | B-M1-77/82: type 必须是合法枚举值 | 创建/更新 |
| 状态校验 | B-M1-79/83/87: 项目活跃 | 创建/更新/删除 |
| 引用完整性 | B-M1-85: 被引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-84: version 匹配 | 更新时 |

##### 4.9.2.6 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 输入框红字 |
| name 已存在（同项目） | 409 | `NAME_CONFLICT` | 输入框红字 |
| display_name 为空 | 400 | `DISPLAY_NAME_REQUIRED` | 输入框红字 |
| type 枚举值非法 | 400 | `INVALID_ENUM` | 下拉选择器红字提示 |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | Toast |
| 外部实体被引用无法删除 | 409 | `ENTITY_IN_USE` | 弹窗展示引用清单 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | Toast + 刷新 |

> **与其他模块的差异**: 外部实体比公司/部门/角色多一个 `type` 枚举字段, 因此多出 `INVALID_ENUM` 错误码和对应异常场景. 其余错误码体系一致.

#### 4.9.3 数据规格

**输入数据（POST Request Body）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|:------:|------|
| name | string | ✅ | — | 编程标识符, 正则 `/^[a-zA-Z0-9_-]+$/`, 2~50 |
| display_name | string | ✅ | — | 显示名称, 1~100 字符 |
| type | string | ✅ | — | 实体类型枚举, 允许值见下表 |
| description | string | ❌ | null | 描述, 0~2000 字符 |

**`type` 枚举值定义：**

| 枚举值 | 显示名称 | 说明 |
|--------|---------|------|
| `system` | 系统 | 外部系统, 如"支付网关"、"第三方 API" |
| `organization` | 组织机构 | 外部组织, 如"政府监管部门"、"行业协会" |
| `person` | 个人角色 | 外部个人, 如"最终用户"、"供应商联系人" |
| `interface` | 接口 | 外部接口规范, 如"REST API"、"消息队列" |

> **注意**: `type` 枚举值的具体集合应在 `docs/02-domain-model/domain-model.md` 中有明确定义. 此处列出的是初始建议值, 最终以领域模型为准.

**输出数据（ExternalEntity Response Body）：**

| 字段 | 类型 | 来源 |说明 |
|------|------|------|------|
| id | string | external_entities.id | UUID |
| project_id | string | external_entities.project_id | 所属项目 |
| name | string | external_entities.name | 编程标识符 |
| display_name | string | external_entities.display_name | 显示名称 |
| type | string | external_entities.type | 实体类型枚举 |
| description | string \| null | external_entities.description | 描述 |
| status | string | external_entities.status | active / archived |
| version | integer | external_entities.version | 版本号 |
| created_at | string | external_entities.created_at | 创建时间 |
| updated_at | string | external_entities.updated_at | 更新时间 |

---

### 4.10 F-M1-10 项目摘要统计

**优先级**: P1 | **前置依赖**: F-M1-01（项目列表 — 统计信息可在列表页展示）, F-M1-03（项目详情 — 摘要 API 已在设计）

> **说明**: 本功能点的详细设计与 F-M1-03（4.3.3 数据规格）中的 Summary API 高度重叠. 此处主要补充**列表页统计展示**和**统计数据的缓存/更新策略**.

#### 4.10.1 涉及领域模型

无新增实体. 统计数据来自对已有表的聚合查询（COUNT）:

| 统计项 | 数据源 | 聚合方式 |
|--------|--------|---------|
| 领域实体总数 | `domain_entities WHERE project_id` | COUNT |
| 业务流程总数 | `business_processes WHERE project_id` | COUNT |
| 公司总数 | `companies WHERE project_id` | COUNT |
| 部门总数 | `departments WHERE project_id` | COUNT |
| 角色总数 | `roles WHERE project_id` | COUNT |
| 外部实体总数 | `external_entities WHERE project_id` | COUNT |

#### 4.10.2 业务规则

##### 4.10.2.1 查询（Query）

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-88 | 列表接口返回时应**内嵌** summary 统计字段, 避免前端额外请求 | 后端在列表查询时用 LEFT JOIN + COUNT 实现 |
| B-M1-89 | 统计数据为近似值即可（不要求事务一致性快照）, 允许毫秒级延迟 | 不需要 SERIALIZABLE 隔离级别 |
| B-M1-90 | 归档项目的统计数据仍然正常计算和展示 | 统计不受 status 过滤 |

##### 4.10.2.2 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|-----------|--------|---------|
| 统计查询超时 | 504 | `TIMEOUT` | 显示"--"占位, 不阻塞列表渲染 |
| 项目不存在 | 404 | `NOT_FOUND` | 404 页面（列表接口不应返回不存在项目的统计） |

#### 4.10.3 数据规格

**列表内嵌统计字段（GET /api/v1/projects Response 中每个 item 额外携带）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| summary.domainEntityCount | integer | 领域实体数 |
| summary.processCount | integer | 业务流程数 |
| summary.companyCount | integer | 公司数 |
| summary.departmentCount | integer | 部门数 |
| summary.roleCount | integer | 角色数 |
| summary.externalEntityCount | integer | 外部实体数 |

> **与 F-M1-03 4.3.3 的关系**: 详情页的 Summary API（`GET /api/v1/projects/:id/summary`）返回完整统计数据; 列表 API 的内嵌 summary 字段返回相同的结构但可能精度略低（允许缓存）. 两处数据结构保持一致.

---

### 4.11 F-M1-11 应用管理

> 应用管理 PRD 详见 `docs/03-prd-ux/modules/application-management/application-management-prd.md`，作为 M1 补充模块独立存放。

---

### 4.12 F-M1-12 角色行为管理

**优先级**: P1 | **前置依赖**: F-M1-08（角色管理 — 角色必须先存在）

> **核心定位**: 管理 Role 的 `actions[]` 和 `decisions[]` JSONB 字段，为 M3 业务流程模块提供 `actionRef`/`decisionRef` 引用源。M3 的 ActivityNode 通过 `holder.type="role"` + `actionRef` 引用 `Role.actions[].id`，DecisionNode 通过 `decisionRef` 引用 `Role.decisions[].id`。
>
> **数据模型特征**: actions 和 decisions 是 `roles` 表的 JSONB 内嵌数组，非独立表。CRUD 操作采用「读取→校验→变更数组→整体写回」模式，使用角色行级乐观锁防并发覆盖。
>
> **与 F-M1-13 的边界**: F-M1-12 仅覆盖 `roles.actions[]` 和 `roles.decisions[]`。`external_entities.actions[]` 和 `external_entities.decisions[]` 由 F-M1-13 管理，结构相同但 API 路径不同。

#### 4.12.1 涉及的领域模型

| 实体 | 表名 | 关系 | 说明 |
|------|------|------|------|
| Role | `roles` | 操作对象 | 更新 `actions` / `decisions` JSONB 字段 |
| Project | `projects` | 父实体（N:1） | 归档时禁止写操作 |

> **领域模型对照**: 在 `docs/02-domain-model/business-process.md` §2 中，RoleAction 和 DecisionDef 定义为 Role 的内嵌行为清单。本 PRD 的 CRUD 操作直接作用于 `roles.actions` 和 `roles.decisions` JSONB 列，不创建新表。
>
> **术语说明**: `domain-model.md` §2.5~2.6 使用泛称 `ActionDef[]` / `DecisionDef[]`，而 `business-process.md` §2 使用更精确的 `RoleAction[]` / `DecisionDef[]`（区分角色行为与 Service 行为）。本 PRD 以 `business-process.md` 的精确命名为准，`ActionDef` 为 `RoleAction` / `ExternalEntityAction` / `ServiceAction` 的泛称。

**ER 关系：**

```
Project (1) ──< (N) Role
                   │
                   ├── actions: JSONB []      ← F-M1-12 管理范围
                   │     └── RoleAction[]
                   │           ├── id, name, displayName, description
                   │           ├── inputs: NodeIO[]
                   │           ├── outputs: NodeIO[]
                   │           ├── logic: { userDesc, data }
                   │           └── tool: ToolRef | null
                   │
                   └── decisions: JSONB []    ← F-M1-12 管理范围
                         └── DecisionDef[]
                               ├── id, name, displayName, description
                               └── branches: DecisionBranchDef[]
                                     ├── name, condition
                                     ├── outputs: NodeIO[]
                                     └── edgeIds: string[]
```

**共用子类型定义（与 F-M1-13 共享）：**

```typescript
// 参数定义 — Action 的 inputs/outputs 和 DecisionBranch 的 outputs 共用
interface NodeIO {
  name: string;             // 参数名（同数组内唯一）
  type: string;             // 数据类型（如 string/number/boolean/datetime 等）
  description?: string;     // 参数描述
  required?: boolean;       // 是否必填
  defaultValue?: any;       // 默认值
  constraints?: object;     // 类型约束（如 { minLength, maxLength, pattern } 等）
}

// 执行工具 — 仅 Role/ExternalEntity 的 Action 使用
type ToolRef =
  | null                                              // 无工具（系统内部自动完成）
  | "email" | "sms" | "phone" | "wechat"             // 内置通知工具
  | { type: "page"; applicationType: "web"|"android"|"ios"|"pc"; pageId: string }  // UI 页面操作
  | { type: "custom"; name: string; [key: string]: unknown };                        // 自定义工具
```

#### 4.12.2 业务动作与输入输出

> 本节定义 F-M1-12 涉及的 8 个业务动作序列（actions CRUD 4 个 + decisions CRUD 4 个）。交互层面的细节见 `project-management-interaction.md`。

**Action CRUD 业务动作：**

| 步骤 | 业务动作 | 输入 | 输出 | 前置条件 | 异常处理 |
|------|---------|------|------|---------|---------|
| 1 | 查询角色的 actions 数组 | roleId | RoleAction[] | 角色存在 | 角色不存在 → 404 |
| 2 | 创建新 Action | roleId + Action body | 创建后的 RoleAction（含系统生成 id） | 角色存在 + 项目活跃 + name 唯一 | name 重复 → 409, 项目归档 → 400 |
| 3 | 更新已有 Action | roleId + actionId + Action body | 更新后的 RoleAction | 角色存在 + 项目活跃 + Action 存在 + 乐观锁 | 不存在 → 404, name 重复 → 409, 锁冲突 → 409 |
| 4 | 删除已有 Action | roleId + actionId | 204 无内容 | 角色存在 + 项目活跃 + Action 存在 + 无流程引用 | 不存在 → 404, 被引用 → 409 |

**Decision CRUD 业务动作：**

| 步骤 | 业务动作 | 输入 | 输出 | 前置条件 | 异常处理 |
|------|---------|------|------|---------|---------|
| 5 | 查询角色的 decisions 数组 | roleId | DecisionDef[] | 角色存在 | 角色不存在 → 404 |
| 6 | 创建新 Decision | roleId + Decision body | 创建后的 DecisionDef（含系统生成 id） | 角色存在 + 项目活跃 + name 唯一 | name 重复 → 409, 项目归档 → 400 |
| 7 | 更新已有 Decision | roleId + decisionId + Decision body | 更新后的 DecisionDef | 角色存在 + 项目活跃 + Decision 存在 + 乐观锁 | 不存在 → 404, name 重复 → 409, 锁冲突 → 409 |
| 8 | 删除已有 Decision | roleId + decisionId | 204 无内容 | 角色存在 + 项目活跃 + Decision 存在 + 无流程引用 | 不存在 → 404, 被引用 → 409 |

> **无状态机**: actions/decisions 是无状态值对象，不存在状态流转。

#### 4.12.3 业务规则

##### 4.12.3.1 查询规则

| 规则编号 | 规则内容 | 说明 |
|---------|---------|------|
| B-M1-91 | 查询 actions/decisions 时，按 JSONB 数组原始顺序返回 | 无额外排序 |
| B-M1-92 | 归档项目的角色 actions/decisions 仍可查询（只读） | 与 G-M1-03 一致 |

##### 4.12.3.2 创建 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-93 | Action `id` 由系统自动生成（UUID v4），客户端不可指定 | 400 INVALID_INPUT |
| B-M1-94 | Action `name` 格式：`/^[a-zA-Z0-9_-]+$/`，2~50 字符 | 400 INVALID_NAME_FORMAT |
| B-M1-95 | Action `name` 在**同一 role 的 actions 数组内**唯一（scope = 单个 role，非整个 project） | 409 NAME_CONFLICT |
| B-M1-96 | Action `displayName` 必填，1~100 字符 | 400 DISPLAY_NAME_REQUIRED |
| B-M1-97 | Action `description` 可选，0~500 字符 | — |
| B-M1-98 | Action `inputs` / `outputs` 为 NodeIO 数组；每项的 `name` 必填且在同一数组内唯一（同数组不重名），`type` 必填（2~50 字符） | 400 INVALID_NODE_IO |
| B-M1-99 | Action `logic.userDesc` 必填，1~2000 字符；`logic.data` 可选，0~10000 字符（注：`business-process.md` 中 data 定义为必填，PRD 调整为可选 — 并非所有 Action 都有 JS 代码，以 PRD 为准） | 400 INVALID_LOGIC |
| B-M1-100 | Action `tool` 可选，值为 null 或合法 ToolRef；内置枚举：null / "email" / "sms" / "phone" / "wechat"；page 类型需含 `applicationType` + `pageId`；custom 类型需含 `name`。Phase 1 不校验 pageId 是否指向真实 page（仅校验格式） | 400 INVALID_TOOL_REF |
| B-M1-101 | 所属角色所在项目必须为 `status='active'` | 400 PROJECT_ARCHIVED |

> **name 唯一性范围说明**: 不同角色可以有同名 action（如"提交订单"对于"采购员"和"审批员"都有意义），因此唯一性范围为 role 内部而非 project 全局。

##### 4.12.3.3 更新 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-102 | Action `id` 不可变更（path param 标识，不随 body 更新） | — |
| B-M1-103 | Action `name` 格式/唯一性同创建，唯一性排除自身 | 400 / 409 |
| B-M1-104 | 其余字段校验规则同创建（B-M1-96~100） | 同创建 |
| B-M1-105 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-106 | 角色 version 乐观锁校验（JSONB 整体写回需防并发覆盖，每次变更递增 role.version） | 409 VERSION_CONFLICT |

##### 4.12.3.4 删除 Action 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-107 | 删除 action 时检查 `process_nodes` 表是否存在 `holder_type='role' AND holder_id=roleId` 且 `action_ref` 引用了此 actionId 的节点；存在则拒绝删除 | 409 ACTION_IN_USE |
| B-M1-108 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-109 | Action 不存在（actionId 在数组中未找到） | 404 ACTION_NOT_FOUND |

> **B-M1-107 Phase 1 预留说明**: 若 Phase 1 中 `process_nodes` 表尚无 `action_ref` 字段，则引用检查暂时跳过，在代码中加 `TODO` 注释标注 M3 实现后需启用此检查。

##### 4.12.3.5 创建 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-110 | Decision `id` 由系统自动生成（UUID v4），客户端不可指定 | 400 INVALID_INPUT |
| B-M1-111 | Decision `name` 格式：同 Action name 规则（B-M1-94） | 400 INVALID_NAME_FORMAT |
| B-M1-112 | Decision `name` 在**同一 role 的 decisions 数组内**唯一 | 409 NAME_CONFLICT |
| B-M1-113 | Decision `displayName` 必填，1~100 字符 | 400 DISPLAY_NAME_REQUIRED |
| B-M1-114 | Decision `description` 可选，0~500 字符 | — |
| B-M1-115 | Decision `branches` 必填，至少包含 **2 个分支**（最少 2 个分支才有判断意义） | 400 INVALID_BRANCHES |
| B-M1-116 | DecisionBranch `name` 必填，同一 Decision 内 branches 不可重名 | 400 INVALID_BRANCH |
| B-M1-117 | DecisionBranch `condition` 可选，为字符串表达式（Phase 1 不做语法校验，仅存储原始字符串） | — |
| B-M1-118 | DecisionBranch `outputs` 为 NodeIO 数组，校验规则同 B-M1-98 | 400 INVALID_NODE_IO |
| B-M1-119 | DecisionBranch `edgeIds` Phase 1 必须为空数组 `[]`（M3 业务流程模块负责填充边 ID） | 400 INVALID_EDGE_IDS |
| B-M1-120 | 所属角色所在项目必须为 `status='active'` | 400 PROJECT_ARCHIVED |

##### 4.12.3.6 更新 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-121 | Decision `id` 不可变更 | — |
| B-M1-122 | Decision `name` 格式/唯一性同创建，排除自身 | 400 / 409 |
| B-M1-123 | 其余字段校验规则同创建（B-M1-113~119） | 同创建 |
| B-M1-124 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-125 | 角色 version 乐观锁校验 | 409 VERSION_CONFLICT |

##### 4.12.3.7 删除 Decision 规则

| 规则编号 | 规则内容 | 违规后果 |
|---------|---------|---------|
| B-M1-126 | 删除 decision 时检查 `process_nodes` 表是否存在引用了此 decisionId 的 Decision 节点；存在则拒绝删除 | 409 DECISION_IN_USE |
| B-M1-127 | 项目必须活跃 | 400 PROJECT_ARCHIVED |
| B-M1-128 | Decision 不存在 | 404 DECISION_NOT_FOUND |

##### 4.12.3.8 校验汇总

| 维度 | 规则 | 触发时机 |
|------|------|---------|
| 格式校验 | B-M1-94/111: name 正则 | 创建/更新 Action/Decision |
| 唯一性校验 | B-M1-95/103/112/122: role 范围内唯一（排除自身） | 创建/更新前 |
| 必填校验 | B-M1-96/113: displayName 必填 | 创建/更新 |
| NodeIO 校验 | B-M1-98/118: inputs/outputs 中 name+type 必填且不重名 | 创建/更新 |
| Branch 校验 | B-M1-115~119: 最少 2 分支 + 分支名唯一 + edgeIds=[] | 创建/更新 Decision |
| Tool 校验 | B-M1-100: ToolRef 格式校验 | 创建/更新 Action |
| 状态校验 | B-M1-101/105/108/120/124/127: 项目活跃 | 所有写操作 |
| 引用完整性 | B-M1-107/126: 被 process_nodes 引用时禁止删除 | 删除前 |
| 乐观锁 | B-M1-106/125: role version 匹配 | 更新时 |

##### 4.12.3.9 异常场景汇总

| 场景 | HTTP 状态码 | 错误码 | 说明 |
|------|-----------|--------|------|
| Action name 格式非法 | 400 | `INVALID_NAME_FORMAT` | 正则不匹配或长度越界 |
| Action name 同角色内冲突 | 409 | `NAME_CONFLICT` | 同 role 的 actions 数组内已存在 |
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

#### 4.12.4 数据规格

##### Action CRUD

**List Actions（GET /api/v1/projects/:projectId/roles/:roleId/actions）**

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | RoleAction[] | roles.actions JSONB | 按数组原序返回，无分页 |

> 无分页：actions 为内嵌数组，单个角色通常 < 20 个 action。

**Create Action（POST /api/v1/projects/:projectId/roles/:roleId/actions）**

输入：

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | `/^[a-zA-Z0-9_-]+$/`, 2~50 | 编程标识符 |
| displayName | string | ✅ | — | 1~100 字符 | 显示名称 |
| description | string | ❌ | null | 0~500 字符 | 描述 |
| inputs | NodeIO[] | ❌ | [] | 见 B-M1-98 | 入参定义 |
| outputs | NodeIO[] | ❌ | [] | 见 B-M1-98 | 出参定义 |
| logic | object | ✅ | — | — | 行为逻辑 |
| logic.userDesc | string | ✅ | — | 1~2000 字符 | 自然语言描述 |
| logic.data | string | ❌ | "" | 0~10000 字符 | JS 代码（可选） |
| tool | ToolRef \| null | ❌ | null | 见 B-M1-100 | 执行工具 |

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | RoleAction | 计算 | 含系统生成的 id |
| version | integer | roles.version | 更新后的角色版本号 |

**Update Action（PUT /api/v1/projects/:projectId/roles/:roleId/actions/:actionId）**

输入：

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | 同创建 | 编程标识符 |
| displayName | string | ✅ | — | 同创建 | 显示名称 |
| description | string | ❌ | null | 同创建 | 描述 |
| inputs | NodeIO[] | ❌ | [] | 同创建 | 入参定义 |
| outputs | NodeIO[] | ❌ | [] | 同创建 | 出参定义 |
| logic | object | ✅ | — | 同创建 | 行为逻辑 |
| logic.userDesc | string | ✅ | — | 同创建 | 自然语言描述 |
| logic.data | string | ❌ | "" | 同创建 | JS 代码 |
| tool | ToolRef \| null | ❌ | null | 同创建 | 执行工具 |
| version | integer | ✅ | — | 乐观锁 | 角色当前版本号 |

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | RoleAction | 计算 | 更新后的完整 Action |
| version | integer | roles.version | 递增后的角色版本号 |

**Delete Action（DELETE /api/v1/projects/:projectId/roles/:roleId/actions/:actionId）**

- 请求：无 body，actionId 在 URL path 中
- 响应：204 No Content（成功）/ 错误码

##### Decision CRUD

**List Decisions（GET /api/v1/projects/:projectId/roles/:roleId/decisions）**

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | DecisionDef[] | roles.decisions JSONB | 按数组原序返回，无分页 |

**Create Decision（POST /api/v1/projects/:projectId/roles/:roleId/decisions）**

输入：

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | `/^[a-zA-Z0-9_-]+$/`, 2~50 | 编程标识符 |
| displayName | string | ✅ | — | 1~100 字符 | 显示名称 |
| description | string | ❌ | null | 0~500 字符 | 描述 |
| branches | DecisionBranchInput[] | ✅ | — | ≥2, 分支名唯一 | 分支定义 |

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | DecisionDef | 计算 | 含系统生成的 id，branches 保持原序 |
| version | integer | roles.version | 更新后的角色版本号 |

**DecisionBranchInput（创建/更新 Decision 时的分支输入）：**

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | 同 Decision 内唯一, 1~50 字符 | 分支标识（如 approved/rejected） |
| condition | string | ❌ | null | 0~500 字符 | 条件表达式（Phase 1 原始字符串，不做语法校验） |
| outputs | NodeIO[] | ❌ | [] | 见 B-M1-98 | 分支输出参数 |
| edgeIds | string[] | ❌ | [] | Phase 1 必须 = [] | 出口边 ID（M3 填充） |

**Update Decision（PUT /api/v1/projects/:projectId/roles/:roleId/decisions/:decisionId）**

输入：

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | 同创建 | 编程标识符 |
| displayName | string | ✅ | — | 同创建 | 显示名称 |
| description | string | ❌ | null | 同创建 | 描述 |
| branches | DecisionBranchInput[] | ✅ | — | 同创建 | 分支定义 |
| version | integer | ✅ | — | 乐观锁 | 角色当前版本号 |

输出：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| data | DecisionDef | 计算 | 更新后的完整 Decision |
| version | integer | roles.version | 递增后的角色版本号 |

**Delete Decision（DELETE /api/v1/projects/:projectId/roles/:roleId/decisions/:decisionId）**

- 请求：无 body，decisionId 在 URL path 中
- 响应：204 No Content（成功）/ 错误码

##### NodeIO 子类型数据规格

| 字段 | 类型 | 必填 | 默认值 | 校验规则 | 说明 |
|------|------|:----:|:------:|---------|------|
| name | string | ✅ | — | 同数组内唯一, 1~50 字符 | 参数名 |
| type | string | ✅ | — | 2~50 字符 | 数据类型（如 string/number/boolean/datetime/text/enum 等） |
| description | string | ❌ | null | 0~200 字符 | 参数描述 |
| required | boolean | ❌ | false | — | 是否必填 |
| defaultValue | any | ❌ | null | — | 默认值 |
| constraints | object | ❌ | null | — | 类型约束（如 { minLength, maxLength, pattern }） |

> **NodeIO 与 EntityField 的区别**: NodeIO 是流程节点的轻量参数定义，用于描述 Action 的输入/输出和 Decision 分支的输出；EntityField 是领域实体的持久化字段定义（含完整校验约束）。两者结构相似但职责不同。

#### 4.12.5 AI 编码提示

- **JSONB 原子写回**: actions/decisions 是 JSONB 数组，更新操作为「读取→校验→修改→写回整个数组」，必须使用角色行级乐观锁（role.version）防止并发覆盖。不可使用 `jsonb_set` 单项更新，因为需要整体校验（如 name 唯一性）
- **id 生成策略**: actionId/decisionId 由后端 `crypto.randomUUID()` 生成。客户端请求 body 中若包含 `id` 字段，必须被忽略（不报错，直接覆盖为系统生成值）
- **process_nodes 引用检查**: 删除 action/decision 时需查 `process_nodes` 表中 `holder_type='role' AND holder_id=roleId` 的行，检查其 `action_ref`/`decision_ref` 是否引用了该 id。Phase 1 若 `process_nodes` 表尚无 `action_ref`/`decision_ref` 字段，则在代码中加 `// TODO: M3 实现后启用 process_nodes 引用检查` 注释标注
- **edgeIds=[] Phase 1 硬约束**: 后端校验必须拦截非空 edgeIds，否则 M3 流程编辑器写入的边 ID 会在 Action/Decision 更新时被误删
- **与 F-M1-13 的代码复用**: NodeIO、ToolRef、DecisionBranch 的校验逻辑应抽取为共享 helper 函数，F-M1-13（ExternalEntity 行为管理）将复用相同结构

---

## 5. 跨功能规则

### 5.1 全局状态流转约束

项目管理模块涉及的核心状态机只有一个: **Project.status**.

#### 5.1.1 Project 状态机

```
         ┌──────────────┐
         │              │
         ▼              │
   ┌──────────┐   归档   │   恢复
   │  active  │─────────│──────────┐
   └──────────┘          │          │
         ▲               │          │
         └───────────────┘          │
              恢复                   │
                                    ▼
                              ┌───────────┐
                              │ archived  │
                              └───────────┘
```

**状态枚举值一致性校验（⚠️ 必须与领域模型 + 数据库 schema 完全一致）：**

| 枚举值 | 显示名称 | 说明 | 领域模型定义位置 | DB Schema 定义位置 |
|--------|---------|------|-----------------|-------------------|
| `active` | 活跃 | 正常可编辑状态 | `docs/02-domain-model/domain-model.md` Project 实体 | `docs/05-data-design/phase1-database-schema.md` projects 表 |
| `archived` | 已归档 | 只读状态, 子数据通过 JOIN 过滤 | 同上 | 同上 |

**允许的状态转换：**

| 当前状态 | 目标状态 | 触发操作 | 转换规则编号 |
|---------|---------|---------|------------|
| `active` | `archived` | 用户点击「归档项目」 | G-M1-01 |
| `archived` | `active` | 用户点击「恢复项目」 | G-M1-02 |

**禁止的转换（隐式规则）：**

| 转换 | 原因 |
|------|------|
| `active` → `active` | 无意义操作 |
| `archived` → `archived` | 无意义操作 |
| 直接创建为 `archived` | 项目创建时默认 `active`, 归档需用户主动操作 |

#### 5.1.2 子实体的状态派生

Company / Department / Role / ExternalEntity 自身也有 `status` 字段, 但它们的**有效状态由 Project.status 派生**:

| 子实体自身 status | Project.status | 有效状态 | 行为 |
|------------------|---------------|---------|------|
|任意值| `active` | 自身 status 生效 | 正常读写 |
| `active` | `archived` | **强制只读** | 隐藏所有写操作入口 |
| `archived` | `archived` | **强制只读** | 隐藏所有写操作入口 |

> **规则 G-M1-03**: 子实体的可编辑性不由自身 `status` 决定, 而由**所属项目的 `status`** 决定. 后端所有写操作 API（POST/PUT/DELETE）必须检查 `projects.status = 'active'`.

### 5.2 全局校验规则

| 规则编号 | 规则内容 | 适用范围 |
|---------|---------|---------|
| G-M1-04 | **name 字段全局格式约定**: 所有实体（Project/Company/Department/Role/ExternalEntity）的 `name` 字段统一遵循正则 `/^[a-zA-Z0-9_-]+$/`, 长度 2~50 | 全模块所有实体的创建和更新 |
| G-M1-05 | **name 唯一性范围的统一模式**: 每种实体的 `name` 在其**直接父实体的范围内**唯一（Project 全局唯一, Company/ExternalEntity 按 project_id, Department 按 company_id, **Role 按 project_id（全局唯一, 因 department_id 为可选挂载）**） | 全模块所有实体的创建和更新 |
| G-M1-06 | **display_name 全局约定**: 所有实体的 `display_name` 必填, 长度 1~100, 支持中英文字符 | 全模块所有实体 |
| G-M1-07 | **乐观锁全局约定**: 所有更新操作（PUT）必须携带 `version` 字段, 后端 SQL 必须 `WHERE version = :currentVersion`, 冲突返回 409 `VERSION_CONFLICT` | 全模块所有 PUT 操作 |
| G-M1-08 | **归档项目全局只读**: 归档项目的所有子实体 API（POST/PUT/DELETE）统一返回 400 `PROJECT_ARCHIVED`, 由中间件或统一拦截器处理 | 全模块所有写操作 API |
| G-M1-09 | **删除引用完整性**: 删除任何实体前, 必须检查 `domain_entities` 和 `business_processes` 表中是否存在引用该实体 `id` 的记录, 存在则返回 409 `ENTITY_IN_USE` | 全模块所有 DELETE 操作 |
| G-M1-10 | **统一错误码体系**: 所有 API 使用统一的错误码命名空间（`INVALID_*`, `*_CONFLICT`, `*_REQUIRED`, `PROJECT_ARCHIVED`, `VERSION_CONFLICT`, `ENTITY_IN_USE`, `NOT_FOUND`, `TIMEOUT`） | 全模块所有 API |

### 5.3 权限与访问控制

> **Phase 1 范围**: MVP 阶段不实现完整的权限系统. 此处定义的是**最小可行权限模型**, 用于隔离不同角色的操作边界.

#### 5.3.1 用户角色定义

| 角色 | 代码 | 说明 |
|------|------|------|
| 项目经理（PM） | `pm` | 项目的全权管理者, 可执行所有读写操作 |
| 研发人员 | `developer` | 只读访问者, 可查看所有数据和页面, 不能执行任何写操作 |
| 测试工程师 | `tester` | 只读访问者, 同 developer |

> **注意**: 此处的「角色」是**系统使用角色**（用于 RBAC 权限控制）, 与 F-M1-08 管理的**业务建模角色**（如"产品经理"、"后端开发"）是不同的概念. 建模角色是 PM 在原型中定义的业务参与者, 系统角色是本系统的访问控制机制.

#### 5.3.2 权限矩阵

| 操作 | PM (`pm`) | Developer (`developer`) | Tester (`tester`) |
|------|:---------:|:---------------------:|:-----------------:|
| 查看项目列表 | ✅ | ✅ | ✅ |
| 查看项目详情 | ✅ | ✅ | ✅ |
| 创建项目 | ✅ | ❌ | ❌ |
| 编辑项目 | ✅ | ❌ | ❌ |
| 归档/恢复项目 | ✅ | ❌ | ❌ |
| 查看/搜索公司 | ✅ | ✅ | ✅ |
| 新建/编辑/删除公司 | ✅ | ❌ | ❌ |
| 查看/搜索部门 | ✅ | ✅ | ✅ |
| 新建/编辑/删除部门 | ✅ | ❌ | ❌ |
| 查看/搜索角色 | ✅ | ✅ | ✅ |
| 新建/编辑/删除角色 | ✅ | ❌ | ❌ |
| 查看/搜索外部实体 | ✅ | ✅ | ✅ |
| 新建/编辑/删除外部实体 | ✅ | ❌ | ❌ |
| 查看/搜索角色行为（actions/decisions） | ✅ | ✅ | ✅ |
| 新建/编辑/删除角色行为（actions/decisions） | ✅ | ❌ | ❌ |
| 查看统计摘要 | ✅ | ✅ | ✅ |

#### 5.3.3 权限实现要点

| 要点 | 说明 |
|------|------|
| **后端权限校验** | 每个 API 端点在业务逻辑前检查用户角色, 非 PM 角色的写操作请求直接返回 403 `FORBIDDEN` |
| **前端权限控制** | 根据 user.role 条件渲染/隐藏写操作按钮（新建/编辑/删除/归档）. 这是 UX 优化, 安全保障靠后端 |
| **权限模型扩展点** | 当前仅有 3 种硬编码角色. Phase 3+ 可能引入动态角色配置, 但 Phase 1 保持简单 |
| **API 响应中的权限提示** | 只读用户访问写操作 API 时, 返回 403 + 错误信息"您没有执行此操作的权限". 前端据此 Toast 提示 |

---

## 6. 验收标准

### 6.1 功能验收

| 编号 | 验收标准（Given-When-Then 格式） | 对应功能点 |
|------|----------------------------------|-----------|
| AC-M1-01 | **Given** 用户已登录且角色为 PM, **When** 访问项目列表页, **Then** 展示所有活跃项目（按更新时间倒序）, 每行显示名称/描述/状态/更新时间/摘要统计 | F-M1-01 |
| AC-M1-02 | **Given** 项目列表页, **When** 输入搜索关键词, **Then** 300ms 防抖后列表过滤为匹配项目, URL 同步 search 参数 | F-M1-01 |
| AC-M1-03 | **Given** 项目列表页, **When** 点击「新建项目」按钮, **Then** 弹出创建对话框, 含 name/display_name/description 三个字段 | F-M1-02 |
| AC-M1-04 | **Given** 创建项目对话框, **When** name 输入含中文或特殊字符, **Then** 实时显示格式错误提示, 「提交」按钮禁用 | F-M1-02, B-M1-07 |
| AC-M1-05 | **Given** 创建项目对话框, **When** 输入已存在的 name, **When** 点击「提交」, **Then** 显示 409 冲突提示, 对话框不关闭 | F-M1-02, B-M1-08 |
| AC-M1-06 | **Given** 创建项目对话框, **When** 填写合法数据并提交, **Then** 项目创建成功, 对话框关闭, 列表顶部出现新项目（乐观更新） | F-M1-02 |
| AC-M1-07 | **Given** 项目列表, **When** 点击某项目名称, **Then** 进入项目详情页, 展示完整信息和模块摘要卡片 | F-M1-03 |
| AC-M1-08 | **Given** 项目详情页, **When** 页面加载, **Then** 详情和摘要 API 并行请求（Promise.all）, 总耗时 = max(两者) | F-M1-03, B-M1-16 |
| AC-M1-09 | **Given** 项目详情页, **When** 点击 name/display_name/description 字段, **Then** 字段切换为编辑态, 出现保存/取消按钮 | F-M1-04 |
| AC-M1-10 | **Given** 项目详情页编辑态, **When** 修改 name 为已存在值并保存, **Then** 显示 409 冲突提示, 编辑态不关闭 | F-M1-04, B-M1-20 |
| AC-M1-11 | **Given** 项目详情页编辑态, **When** 点击「取消」或按 Esc, **Then** 字段还原到进入编辑时的原始值（快照还原） | F-M1-04 |
| AC-M1-12 | **Given** 活跃项目详情页, **When** 点击「归档项目」按钮, **Then** 弹出 AlertDialog 确认框, 含红色确认按钮和警告文案 | F-M1-05 |
| AC-M1-13 | **Given** 归档确认弹窗, **When** 点击「确认」, **Then** 项目状态变为 archived, 页面显示「已归档」Badge, 所有编辑入口隐藏 | F-M1-05 |
| AC-M1-14 | **Given** 归档项目详情页, **When** 点击「恢复项目」按钮, **Then** 弹出确认框, 确认后项目恢复为活跃态, 编辑入口恢复 | F-M1-05 |
| AC-M1-15 | **Given** 归档项目, **When** 尝试通过 API 直接编辑, **Then** 返回 400 PROJECT_ARCHIVED | F-M1-05, B-M1-22, G-M1-08 |
| AC-M1-16 | **Given** 项目详情页 → 组织架构 Tab, **When** Tab 加载完成, **Then** 展示公司列表（含名称/描述/部门数/已挂载角色数统计）, 顶部有新建按钮和搜索框 | F-M1-06 |
| AC-M1-17 | **Given** 组织架构 Tab, **When** 点击「新建公司」, **Then** 弹出对话框, 提交后在列表中出现新公司 | F-M1-06 |
| AC-M1-18 | **Given** 公司列表, **When** 选中某公司, **Then** 加载该公司的部门**树形列表**（支持展开/折叠多级层级）, 面板切换到部门视图 | F-M1-07 |
| AC-M1-19 | **Given** 项目详情页 → 「角色」Tab, **When** 加载完成, **Then** 展示该项目全部角色列表（含归属标记: 部门名或"独立"）, 有新建/搜索/部门筛选/编辑/删除能力 | F-M1-08 |
| AC-M1-19b | **Given** 角色列表, **When** 点击「新建角色」, **Then** 弹出对话框含 name/display_name/description/部门（可选下拉, 含"不挂载"选项）, 不选部门提交后创建独立角色 | F-M1-08, B-M1-63 |
| AC-M1-19c | **Given** 角色列表, **When** 使用部门筛选器选择某部门或"独立", **Then** 列表过滤为匹配角色; 从公司/部门卡片点击挂载数字可自动跳转并应用对应筛选 | F-M1-08, B-M1-58 |
| AC-M1-20 | **Given** 删除公司并确认, **When** 后端执行完毕, **Then** 公司及其下属部门被删除, 原挂载到该公司部门下的角色变为独立角色（department_id=null）, 角色本身保留 | F-M1-06, B-M1-39 |
| AC-M1-20b | **Given** 删除部门并确认（该部门有子部门和已挂载角色）, **When** 后端执行完毕, **Then** 该部门及子部门被递归删除, 原挂载角色变为独立角色, 删除确认弹窗事先展示了增强警告信息 | F-M1-07, B-M1-54 |
| AC-M1-21 | **Given** 被领域实体引用的公司, **When** 尝试删除, **Then** 返回 409 ENTITY_IN_USE, 弹窗展示引用清单 | F-M1-06, B-M1-38 |
| AC-M1-22 | **Given** 组织架构 Tab → 外部实体子 Tab, **When** 加载完成, **Then** 展示外部实体列表（含类型 Badge）, 有新建/搜索/编辑/删除能力 | F-M1-09 |
| AC-M1-23 | **Given** 项目列表页, **When** 每行项目数据, **Then** 内嵌 summary 统计字段（实体数/流程数/组织数）, 无需额外请求 | F-M1-10, B-M1-88 |
| AC-M1-24 | **Given** Developer 或 Tester 角色用户, **When** 访问任意页面, **Then** 所有写操作按钮（新建/编辑/删除/归档）均不可见, 列表/详情正常展示 | §5.3 |
| AC-M1-25 | **Given** 活跃项目下的角色 R（actions=[], decisions=[]）, **When** POST 创建 action A1（name=submit_order, displayName=提交订单, inputs=[{name:"orderId",type:"string"}], outputs=[{name:"result",type:"string"}], logic={userDesc:"用户提交订单"}）, **Then** 返回 201，A1.id 为 UUID，R.actions=[A1] | F-M1-12 |
| AC-M1-26 | **Given** 角色 R 有 action A1, **When** PUT 更新 A1 的 displayName 为"提交采购单", **Then** 返回 200，A1.displayName 已更新，R.version 递增 | F-M1-12 |
| AC-M1-27 | **Given** 角色 R 有 action A1, **When** DELETE 删除 A1, **Then** 返回 204，R.actions 不再包含 A1 | F-M1-12 |
| AC-M1-28 | **Given** 角色 R, **When** POST 创建 decision D1（name=review_result, displayName=审核结果, branches=[{name:"approved"},{name:"rejected"}]）, **Then** 返回 201，D1.id 为 UUID，R.decisions=[D1] | F-M1-12 |
| AC-M1-29 | **Given** 角色 R 有 decision D1（branches=[approved, rejected]）, **When** PUT 更新 D1 新增 branch "escalated"（含 outputs）, **Then** D1.branches 有 3 个分支 | F-M1-12 |
| AC-M1-30 | **Given** 角色 R 有 decision D1, **When** DELETE 删除 D1, **Then** 返回 204，R.decisions 不再包含 D1 | F-M1-12 |
| AC-M1-31 | **Given** 角色 R 有 action A1（name=submit）, **When** POST 创建 action name=submit, **Then** 返回 409 NAME_CONFLICT | F-M1-12, B-M1-95 |
| AC-M1-32 | **Given** 角色 R 有 decision D1（branches=[A,B]）, **When** PUT 更新 D1 branches 仅保留 [A], **Then** 返回 400 INVALID_BRANCHES（<2 分支） | F-M1-12, B-M1-115 |
| AC-M1-33 | **Given** 归档项目下的角色 R, **When** POST 创建 action, **Then** 返回 400 PROJECT_ARCHIVED | F-M1-12, B-M1-101 |

### 6.2 异常验收

| 编号 | 验收标准（Given-When-Then 格式） | 对应规则 |
|------|----------------------------------|---------|
| AC-M1-E01 | **Given** 用户访问不存在的项目 ID, **When** 详情页加载, **Then** 展示友好 404 页面（非通用 Error Boundary） | F-M1-03 |
| AC-M1-E02 | **Given** 两个浏览器窗口同时打开同一项目详情, **When** 窗口 A 保存编辑, 窗口 B 再保存, **Then** 窗口 B 收到 409 VERSION_CONFLICT, 提示刷新 | F-M1-04, B-M1-22 → G-M1-07 |
| AC-M1-E03 | **Given** 项目下有 N 个公司和 M 个部门, **When** 归档该项目, **Then** 公司和部门记录本身不变, 但列表查询时通过 JOIN projects.status 自动过滤 | F-M1-05, B-M1-25, G-M1-03 |
| AC-M1-E04 | **Given** 网络中断, **When** 用户提交任意表单, **Then** 按钮停止 loading, 显示网络错误 Toast, 数据不丢失（编辑态保留） | — |
| AC-M1-E05 | **Given** 搜索框快速连续输入 5 个字符, **When** 观察 API 调用, **Then** 仅在停止输入 300ms 后发起 1 次请求（非 5 次） | B-M1-03 |
| AC-M1-E06 | **Given** PM 用户, **When** 通过 API 调试工具（如 Postman）发送 DELETE 请求到被引用的实体, **Then** 返回 409 ENTITY_IN_USE + 引用清单 JSON | G-M1-09 |
| AC-M1-E07 | **Given** 两个窗口同时编辑同一角色的 actions, **When** 窗口 A 新增 action 后窗口 B 也新增, **Then** 窗口 B 收到 409 VERSION_CONFLICT | F-M1-12, B-M1-106 |
| AC-M1-E08 | **Given** 角色 R 的 action A1 被 process_node 引用, **When** DELETE 删除 A1, **Then** 返回 409 ACTION_IN_USE | F-M1-12, B-M1-107 |
