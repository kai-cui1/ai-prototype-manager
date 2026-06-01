# 系统使用工作流

> 本文档独立管理 ai-prototype-manager 系统的完整使用工作流。
> 工作流内容会随着系统建设持续补充和迭代。
>
> 最后更新：2026-04-28

---

## 完整工作流：A → F 六阶段

> 本系统不仅是原型设计工具，更是**产品定义的单一事实来源（Single Source of Truth）**。
> PM 通过本系统完成从业务理解到产品定义的全过程，产出物向下连接研发实现和测试验证。

---

### 阶段 A：理解业务

#### Step 1: 项目初始化 ⭐

PM 定义项目的基本信息。

**详细规格**：

###### 1.1 项目元信息

PM 填写（或 AI 根据对话内容自动提取）：

| 字段 | 必填 | 说明 |
|------|:----:|------|
| name | ✅ | 项目名称 |
| description | ✅ | 项目描述（一句话定位） |
| goals | ✅ | 项目目标和范围 |
| targetUsers | — | 目标用户/设备/场景描述 |
| constraints | — | 技术约束 / 业务约束 / 合规要求 |

**产出**：`Project.meta`（详见 `docs/02-domain-model/domain-model.md` §2.1 Project）

```
Project
├── id, name, description
├── version, status (draft|review|published|archived)
├── createdAt, updatedAt
└── 关联关系 → Application[] / DomainModelDef[] / BusinessProcess[] / Role[] / Rule[]
```

###### 1.2 AI 辅助策略

| 触发方式 | AI 行为 |
|---------|---------|
| PM 描述项目愿景 | 自动提取结构化字段（name/goals/constraints），缺失项主动提问 |
| PM 给出竞品或参考 | 分析参考系统的功能边界，建议本项目范围 |
| 项目创建后 | 调用 `suggestNextStep()` 推荐下一步（通常 → Step 2 领域建模） |

---

#### Step 2: 领域建模 ⭐

PM + AI 协作识别业务领域中的核心概念。

**详细规格**：`docs/02-domain-model/domain-model.md`（v1.0，~19 实体，5 大域）

###### 2.1 引导流程

```
Step 2.1: 识别实体
  PM 描述业务场景 → AI 提取候选实体列表 → PM 确认/增删/修改

Step 2.2: 定义实体属性
  对每个实体 → 定义字段（name / type / required / constraints）
  字段类型参考 docs/04-app-shared-resources.md 的 26 种类型

Step 2.3: 建立关系
  定义实体间关系（1:N / N:N / 组合 / 继承 / 关联）
  → addRelation({ fromEntity, toEntity, type, name })

Step 2.4: 审查与完善
  AI 运行 checkCompleteness(scope='domain') → 检测孤立实体、缺字段、循环依赖等
```

###### 2.2 领域模型五大数据域

| # | 域 | 核心实体 | 与本步骤的关系 |
|---|-----|---------|---------------|
| 1 | **项目管理** | Project, Member | Step 1 已创建 Project |
| 2 | **应用与页面** | Application, Page, Component, Zone, DesignArtifact | 在 Step 4 使用 |
| 3 | **流程与交互** | BusinessProcess, ProcessStep, ProcessTrigger, Hook | 在 Step 3 使用 |
| 4 | **数据与规则** | DomainModelDef, Entity, Field, Rule, Role | 本步骤核心产出 |
| 5 | **程序服务** | Endpoint, ScheduleTask, GlobalAction | 后续步骤使用 |

###### 2.3 产出物

```
Project
└── domainModels[]           ← ★ 新增：领域模型定义
    ├── DomainModelDef { id, name, entities[], relationships[] }
    │   └── Entity { id, name, fields[], ... }
    │       └── Field { name, type, required?, constraints? }
    └── relationships[]          ← 实体间关系
```

---

### 阶段 B：定义系统如何运转 ⭐ 核心新增阶段

#### Step 3: 业务流程设计 ⭐

PM + AI 梳理本系统的核心业务流程。

**详细规格**：`docs/08-business-process.md`（v1.3，1476 行，48 项设计决策）

---

##### 3.1 核心架构：四层模型

```
Layer 3: ProcessArchitecture — 不限层数树形分类导航（纯手动）
    ↓ 选取节点段
Layer 2: Process — 全局池的命名切片（仅存引用 ID，childProcessIds[] 支持嵌套）
    ↓ 构成
Layer 1: 全局节点池 + 边池 — processNodes[](ActivityNode+DecisionNode) + processEdges[]
         （真相层，无独立 Graph 实体）
```

**核心哲学**：底层是全局原子节点池+边池；流程只是选取和命名；架构是人类可读性的组织层。

---

##### 3.2 PM 操作流程

###### Step 3.1: 确定参与者

在画流程图之前，先确定系统中有哪些「谁」在参与：

| 参与者类型 | 定义位置 | 包含内容 |
|-----------|---------|---------|
| **Role** | `roles[]` | actions[] + decisions[] + tool |
| **Service** | `applications[type="service"]` | actions[] + decisions[]（自动执行） |
| **ExternalEntity** | `externalEntities[]` | actions[] + decisions[]（外部软硬件） |

三类参与者完全对称——都有 `actions[]` 和 `decisions[]` 集合。

**操作**：
1. AI 根据项目描述建议初始参与者列表
2. PM 审核确认/增删/修改
3. 为每个参与者定义其 `actions[]`（行为）和 `decisions[]`（判断）

###### Step 3.2: 创建流程

三种创建方式：

| 方式 | 场景 | 操作 |
|------|------|------|
| **AI 初稿** | 简单流程（<10 节点） | PM 描述业务场景 → AI 自动生成骨架 → PM 审核 |
| **逐步引导** | 复杂/关键流程 | PM 一步一步添加节点和边 |
| **导入已有** | 组合已有流程 | 从系统中选择已有 Process 导入为子流程 |

**创建空流程后**，进入泳道编辑器：

```
交互路径：
1. PM 从参与者列表拖入 Role / Service / ExternalEntity → 形成纵向泳道
   （横轴 = 流程步骤，纵轴 = 参与者泳道）

2. 在目标泳道右键 → 「新增活动节点」或「新增判断节点」

3. Activity 节点：
   → 选择 holder（当前泳道的参与者）
   → 从 holder.actions[] 下拉选择 Action（无合适则新建）
   → 如果该 Action 在全局池中已有对应 ActivityNode → 复用
   → 否则 → 在 processNodes[] 中新建一条记录

4. Decision 节点：
   → 选择 holder
   → 从 holder.decisions[] 下拉选择 DecisionDef（无合适则新建）
   → 新建时逐行添加分支（name + condition + outputs）

5. 创建边：
   → 从源节点拖拽到目标节点
   → 系统自动检查 (source,target) 唯一性（已有边自动加载）
   → 弹出配置面板 → AI 自动根据两端 I/O 填充 mappings 候选 → PM 确认
```

###### Step 3.3: 子流程拆分（可选）

当流程较大时，PM 可以将其拆分为父子层次：

```
操作路径：
1. 多选一段连续的节点序列 → 右键 → 「提取为子流程」
2. 或：右键 → 「插入子流程」→ 自顶向下创建
3. 或：「导入子流程」→ 从已有流程中选择导入

约束（自动校验）：
✅ 子流程节点集 ⊆ 父流程节点集
✅ 同一父流程下兄弟子流程之间节点互斥
⚠️  跨子流程回边强警告（允许但不推荐）
```

渲染效果：父流程中子流程以折叠卡片展示（在入口 holder 泳道内），点击递归进入详情。

---

##### 3.3 数据流模型

**唯一数据路径：纯管道模型**

```
Action output → Edge.payload.mappings → Action input

唯一补充：DecisionBranch.outputs（decision→activity 边的数据来源）

没有：variables、流程级常量、全局上下文、状态变量
```

**并行性**：一个 Action 有多个出边 → 自然并行（Edge 只表达同步信息传递+时间延续，无显式异步概念）。

**循环**：允许回边（= 普通边，无特殊类型）。静态分析检测无出口循环并警告。

---

##### 3.4 AI 辅助能力

| 能力 | 触发方式 | 说明 |
|------|---------|------|
| **自然语言批量生成** | PM 输入/粘贴业务描述 | AI 解析后生成节点+边骨架（含 holder/actionRef/decisionRef/mappings） |
| **完整性校验** | 实时 / 手动触发 | 检测孤立节点、断链、无出口循环、跨子流程风险等 |

---

##### 3.5 产出物清单

完成 Step 3 后，项目中新增/更新的数据：

```
Project
├── roles[]                  ← 更新：每个 Role 的 actions[] + decisions[]
├── externalEntities[]       ← 更新：每个实体的 actions[] + decisions[]
├── applications[]           ← 更新：service 类型的 actions[] + decisions[]
├── processNodes[]           ← ★ 新增/更新：所有 ActivityNode + DecisionNode
├── processEdges[]           ← ★ 新增/更新：所有边（含 mappings）
├── businessProcesses[]      ← ★ 新增/更新：Process 对象（含 childProcessIds[]）
└── processArchitecture?     ← 可选：流程分类导航树
```

---

### 阶段 C：定义人机接口

#### Step 4: 应用框架规划 ⭐

基于「领域模型」+「业务流程」，规划应用结构。

**详细规格**：

###### 4.1 规划 Application

PM 决定需要哪些应用（参考 `docs/02-domain-model/domain-model.md` §3 应用与页面）：

| Application.type | 说明 | 典型场景 |
|-----------------|------|---------|
| `web` | Web 应用，含 pages[] / globalActions[] / timers[] / conventions[] | 管理后台、用户前台 |
| `ios` | iOS 原生应用 | 移动端 App |
| `android` | Android 原生应用 | 移动端 App |
| `pc` | 桌面客户端 | 工业控制终端 |
| `service` | 后端服务（无 UI），含 actions[] / decisions[] / scheduleTasks[] | 定时任务、API 服务 |

一个项目可以有多个不同类型的 Application。

###### 4.2 规划 Page → 流程映射

核心问题：**每个 Page 对应流程中的哪些人工任务节点？**

```
映射规则：
1. 遍历 businessProcesses[] 中所有 type="activity" 的节点
2. 找到 holder.type = "role" 且 tool.type = "page" 的节点
3. 这些节点就是「需要人机交互的步骤」→ 每个对应一个或多个 Page
4. 对于 tool 中指定了 pageId 的节点 → 直接关联到该 Page
5. 其余页面为「独立交互页面」（非流程驱动，如设置页、仪表盘）

产出：
  applications[].pages[]  ← 每个页面的基本定义
```

###### 4.3 页面结构定义（不含布局）

每个 Page 定义：

```
Page {
  pageId, name, displayName, description?
  applicationId                    ← 所属 App
  zones?: Zone[]                   ← 逻辑分区（header/sidebar/main/footer）
  components: ComponentTree          ← 组件树（语义结构，不含坐标）
}
```

> **注意**：本步骤只定义「有什么组件」，不定义「摆在哪里」。布局在阶段 D 通过外部设计稿导入解决。

**产出**：`applications[].pages[]`（组件树 + zones[]，layoutHint 留空）

---

#### Step 5: 页面细节设计 ⭐

每个 Page 内部的组件级设计。

**详细规格**：

###### 5.1 选择组件

从标准组件库中选择组件（详见 `docs/07-component-library.md`，~52 组件 / 6 分类）：

| 分类 | 组件数 | 示例 |
|------|--------|------|
| Navigation | 8 | Menu, Breadcrumb, Tabs, Steps, Pagination |
| FormInput | 10 | Input, Select, DatePicker, Upload, Switch |
| DataDisplay | 10 | Table, List, Card, Chart, Tag |
| Feedback | 6 | Alert, Message, Spin, Modal (无onConfirm) |
| Overlay | 5 | Drawer, Popover, Tooltip, Image |
| Container | ~13 | Layout, Grid, Form, Divider, Space |

**三层继承体系**：ComponentBase → CategoryBase(6) → Specific(~52)

###### 5.2 构建组件树

操作路径：
1. PM 在 Page 的某个 Zone 或父 Component 下添加子组件
2. 从组件库选择类型 → AI 根据 context 智能填充 props 默认值
3. PM 确认或修改属性
4. 嵌套添加子组件 → 构建完整树

**MCP 操作**：`componentAdd(parentId, def)` / `componentUpdate(compId, updates)`

###### 5.3 定义交互逻辑（Hook）

为组件添加生命周期钩子（详见 `docs/05-object-lifecycle.md`）：

```
三层事件分类：
├── Base（4 个通用）: onMount / onUpdate / onUnmount / onError
├── Capability（6 类 ~20 个）:
│   ├── 表单: onSubmit / onReset / onValidate / onSuccess / onError
│   ├── 导航: onNavigate / onBeforeLeave
│   ├── 展示: onExpand / onCollapse / onSelect / onChange
│   └── 数据: onLoad / onRefresh / onEmpty
└── Specific: 组件特有事件

Hook 定义格式：
  hooks[]:
    - eventId
    - eventType              ← 三层分类之一
    - logic: { userDesc, data }  ← userDesc=自然语言描述, data=JS代码
```

**关键决策**：不冒泡架构、并行执行、纯 JS 条件语法、Hook 内自治错误处理。

###### 5.4 数据绑定

将组件绑定到数据模型的字段：

```
bindingSet(compId, "User.name")    ← 声明式绑定路径
  → 该组件的值自动关联到 domainModels 中 User 实体的 name 字段
```

数据流向由系统自动扫描推导（docs/04 §16）：分析所有读写操作 → 自动生成 source/destination 元数据。

###### 5.5 权限注解

为组件添加权限控制：

```
permissionAdd(compId, { visible: ["admin"], editable: ["admin", "editor"] })
  → viewer 角色看不到此组件
  → editor 可以看到但不能编辑
```

**产出**：完整的 Component 树 + props + hooks + bindings + permissions

---

### 阶段 D：视觉与验证

#### Step 6: 导出 → 设计工具 → 导入 ⭐

**详细规格**：`docs/06-external-design-integration.md`（设计完成）

###### 6.1 核心范式

> **本系统不做布局引擎。** 视觉呈现委托给第三方专业工具（Figma / v0 / Cursor / Devin 等）。

```
本系统（语义层）          外部工具（视觉层）
├── 信息架构管理            ├── 布局引擎
├── 功能逻辑定义            ├── 高保真渲染
├── 外部设计稿映射管理       └── 像素级精确计算
└── 双轨制产物输出
```

###### 6.2 完整工作流（4 步）

**步骤 1：导出设计骨架**
```
本系统 → MCP/API → 第三方设计工具
导出内容：
  - Page 的 components[] 语义树（不含坐标）
  - zones[] 逻辑分区信息
  - layoutHint 纯文本建议（如 "三栏布局，左侧导航200px"）
```

**步骤 2：第三方工具产出高保真设计稿**
```
第三方工具产出：
  - HTML + CSS（完整可渲染页面）— 或
  - 图片（截图/设计稿）
```

**步骤 3：PM 导入 + AI 映射**
```
PM 导入高保真产物 → 系统存储为 designArtifact
AI 执行：
  - 识别视觉区域 → 匹配 Component 树中的节点
  - 建立 mapping 锚点
  - 两种映射模式：
    Mode A（严格映射）：一一对应，偏差报错
    Mode B（智能建议）：AI 可提议调整组件结构
  - 双粒度：默认组件级，可选子元素级精细映射
```

**步骤 4：校验闭环**
```
hint + validation 闭环：
  PM 布局意图 → 导出时携带 hint → 导入后 AI 校验 → 偏差报告 → PM 修正
```

###### 6.3 layout 字段多态 Schema

```
Component.layout:
  ├── type: "html"    → { selector: "#header .logo" }     // CSS 选择器引用
  ├── type: "image"   → { boundingBox: { x, y, w, h } } // 边界框
  └── type: "svg_path" → { path: "M0,0 L100,0 ..." }   // SVG 路径
```

**产出**：`designArtifacts[]` + 各 `Component.layout`

---

#### Step 7: 运行与验证 ⭐

两种运行模式：

**详细规格**：

###### 7.1 模式 A：原型介绍模式（主模式）

| 特征 | 说明 |
|------|------|
| **定位** | 主模式，PM 日常使用 |
| **呈现** | 逻辑说明 + 元数据编辑面板，不运行原型代码 |
| **核心能力** | 浏览组件树、查看 Hook 定义、检查数据绑定、审阅权限注解、追踪业务流程 |
| **适用场景** | PM 向他人介绍产品、评审设计、演练业务流程 |

###### 7.2 模式 B：原型演练模式（辅助模式）

| 特征 | 说明 |
|------|------|
| **定位** | 辅助模式，用于演示和体验 |
| **呈现** | 高保真界面 + 可交互 Mock 运行 |
| **核心能力** | 渲染 HTML 视觉层、模拟用户操作（点击/输入/跳转）、Mock 数据填充表单/列表 |
| **数据来源** | 从 domainModels 自动生成示例数据副本（docs/04 §17） |
| **适用场景** | 向客户演示、内部评审会、投资人展示 |

> **两种模式的切换是同一份数据的不同呈现方式。** 语义层是共享的，区别仅在视觉层是否激活。

###### 7.3 与阶段 D 的关系

```
Step 6（导入外部设计稿）→ 提供 visual 层素材
Step 7（运行与验证）    → 将 semantic + visual 组合呈现
                      → 模式 A：主要看 semantic
                      → 模式 B：semantic + visual 联合运行
```

---

### 阶段 E：与研发系统集成 ⭐ 新增

#### Step 8: 研发规格输出 ⭐

本系统通过 MCP/API 向研发侧输出完整的产品实现规格。

**详细规格**：`docs/09-mcp-interface.md`（下游接口延后设计，以下为预留框架）

###### 8.1 三大输出维度

| 维度 | 内容 | 数据来源 | 消费者 |
|------|------|---------|---------|
| **前端功能规格** | 页面结构 / 组件清单 / 交互逻辑 / 数据绑定 / 状态管理 | applications[].pages[] + components[] + hooks[] + bindings | Coding AI / 前端开发 |
| **后端功能规格** | API 接口定义 / 业务流程实现逻辑 / 数据处理 / 权限控制 | businessProcesses[] + processNodes[] + rules[] + roles[] | Coding AI / 后端开发 |
| **设备交互规格** | 设备协议 / 信号定义 / 控制逻辑 / 异常处理 | externalEntities[] + actions[] + decisions[] | 嵌入式 / IoT 开发 |

###### 8.2 下游 MCP 接口（预留，待阶段二设计）

> 当前仅定义了方向和分组，具体 Schema 在编码阶段前设计。

```
Group D-1: 前端规格查询
  getPages()           → 完整页面结构树
  getPageDetail(pageId) → 含组件树+props+hooks+bindings
  getInteractions(pageId) → 该页面所有交互逻辑
  getDataModel()      → 领域模型完整定义

Group D-2: 后端规格查询
  getProcesses()       → 所有业务流程
  getProcessDetail(pid) → 含节点+边+数据流
  getAPIEndpoints()    → API 定义（从 service 应用类型推导）
  getRules()           → 业务规则列表

Group D-3: 设备规格查询
  getExternalEntities() → 外部实体及操作
  getDeviceProtocols()  → 设备通信协议定义
```

###### 8.3 未来能力：实现对照检查

> **非当前阶段范围，记录为愿景能力。**

研发完成后，系统可检查实现是否覆盖了原型的所有能力：

| 对照维度 | 检查方式 |
|---------|---------|
| API 完整性 | 原型定义的 Endpoint vs 实际实现的 API |
| 流程覆盖度 | 原型业务流程 vs 后端实际处理链路 |
| 交互完整性 | 原型 hooks[] vs 前端实际事件处理 |
| 规则实现度 | 原型校验规则/权限注解 vs 代码级实现 |

---

### 阶段 F：与测试系统集成 ⭐ 新增

#### Step 9: 测试用例生成 ⭐

本系统中定义的结构化信息可作为测试系统的优质输入来源。

**详细规格**：

###### 9.1 自动化测试用例生成映射

| 来源（原型中的定义） | 自动生成的测试类型 | 生成策略 | 示例 |
|---------------------|-------------------|---------|------|
| `businessProcesses[]` | **端到端测试场景** | 遍历每个 Process 的 entry→...→exit 路径，生成完整用户旅程测试 | 「订单创建→支付→发货→签收」全流程；「工单创建→分配→执行→反馈」 |
| 组件 `hooks[]` | **交互测试用例** | 对每个 Hook 生成前置条件→触发动作→预期结果的测试步骤 | 点击「提交」→ 校验必填项 → 调用 createOrder API → 检查响应成功 → 显示成功提示 |
| 权限注解 `permissions[]` | **权限测试矩阵** | 笛积产物：角色数 × 可见组件 × 可编辑组件 × 操作类型 | admin 可见 10 个组件 / editor 可编辑 5 个 / viewer 仅可查看 3 个 |
| 校验规则 `constraints` | **输入边界测试** | 对每个字段的 rule 生成：空值 / 超长 / 格式非法 / 类型错误 / 边界值 | 用户名：空 / >50字符 / 含特殊字符 / SQL注入尝试 |
| 业务流程分支 `conditions` | **分支覆盖率测试** | 对 Decision 的每个 branch 生成独立测试路径 | 金额≤1000 → 自动通过；>1000 → 升级审批；审批驳回 → 回到修改 |

###### 9.2 测试输出接口（预留）

> 与 Step 8 同理，下游测试接口在阶段二设计。

```
Group F-1: 用例查询
  getE2EScenarios(processId?)   → 端到端场景列表
  getInteractionTests(pageId?)   → 交互测试用例
  getPermissionMatrix()        → 权限测试矩阵
  getBoundaryTests(entityId?)   → 输入边界测试

Group F-2: 批量导出
  exportTestSuite(format)       → 导出完整测试套件
    → format: "json" / "pytest" / "jest" / "cucumber"
```

---

## 待补充项

- [x] **~~Step 1 详细规格~~** ✅ v1.0 完成（项目元信息 + AI辅助 + Project Schema）
- [x] **~~Step 2 详细规格~~** ✅ v1.0 完成（5大域引导流程 + 实体/字段/关系 + 产出物）
- [x] **~~Step 3 详细规格~~** ✅ v1.0 完成（四层架构 + 泳道操作 + 子流程 + 数据流 + AI辅助）
- [x] **~~Step 4 详细规格~~** ✅ v1.0 完成（Application规划 + 流程→Page映射 + Zone定义）
- [x] **~~Step 5 详细规格~~** ✅ v1.0 完成（组件库选择 + 组件树构建 + Hook定义 + 数据绑定 + 权限）
- [x] **~~Step 6 详细规格~~** ✅ v1.0 完成（4步工作流 + 双模式映射 + layout多态Schema + 校验闭环）
- [x] **~~Step 7 详细规格~~** ✅ v1.0 完成（介绍模式 vs 演练模式 + 双轨制呈现 + Mock数据）
- [x] **~~Step 8 详细规格~~** ✅ v1.0 框架完成（三维度输出 + 下游MCP预留 + 实现对照检查愿景）
- [x] **~~Step 9 详细规格~~** ✅ v1.0 框架完成（5类测试生成映射 + 批量导出格式）
- [ ] **完整端到端示例**（一个工业控制项目的完整 A→F 操作过程）— 可选，高价值
