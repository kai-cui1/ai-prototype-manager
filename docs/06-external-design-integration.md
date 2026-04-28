# 外部设计稿集成与布局映射

> **任务编号**：独立新任务（原计划合并入 Task 1.8，后经讨论独立为单独设计任务）
> **状态**：✅ 设计完成
> **日期**：2026-04-27
> **定位**：定义原型系统与外部高保真设计工具之间的集成范式——本系统专注语义/逻辑管理，布局呈现委托给第三方专业工具

---

## 1. 范式定位：原型系统不做布局

### 1.1 核心原则

本系统是**语义/逻辑管理层**，不是布局渲染引擎。视觉呈现委托给第三方专业工具（Figma / v0 / Cursor / Devin 等）。

```
传统理解（❌ 不再采用）：
  原型系统 = 页面结构 + 组件布局 + 交互逻辑 + 数据绑定
  （什么都做，布局是核心难题）

新范式（✅ 当前定位）：
  原型系统 = 信息架构 + 功能逻辑 + 外部设计稿映射锚点
  （专注语义，布局委托给专业工具）
```

### 1.2 职责边界

| 做 | 不做 |
|---|------|
| 信息架构管理（Apps/Pages/组件树） | 布局引擎（Flexbox/Grid/Auto Layout 等算法实现） |
| 功能逻辑定义（Hook/交互/数据绑定/业务规则） | 高保真视觉渲染 |
| 外部设计稿 ↔ Component 的映射管理 | 像素级精确布局计算 |
| 原型介绍模式的逻辑说明呈现 | — |
| 原型演练模式的 Mock 运行时 | — |

### 1.3 设计哲学

> **「语义优先，视觉外包」**——PM 的核心价值在于定义产品「是什么」和「怎么做」，而非「长什么样」。让专业的设计工具负责视觉，让本系统专注于 PM 真正需要管理的：信息架构、交互逻辑、数据关系、业务规则。

---

## 2. 完整工作流（5 步）

> ⚠️ **注意**：本节为工作流框架概要，详细内容记录在独立的 `docs/workflow.md` 文档中，后续持续补充。

```
步骤 1: 项目建立与领域建模
  PM → 本系统 → 项目目标 / 业务流程 / 领域对象 / 领域模型

步骤 2: 应用框架搭建（无布局）
  PM → 本系统 → Apps / Pages / 页面核心元素
  （只定义「有什么」，不定义「怎么摆」）

步骤 3: 导出设计骨架 → 第三方工具
  本系统 → MCP/API → 第三方设计工具
  → 高保真设计稿（HTML/图片）

步骤 4: 导入 + AI 映射
  PM 导入高保真产物 → AI 识别区域 → 建立映射锚点
  → Component.layout = 外部设计稿中的位置引用

步骤 5: 运行时渲染（双模式）
  介绍模式：逻辑说明 + 元数据编辑（不运行）
  演练模式：高保真界面 + 可交互（运行 Hook + Mock）
```

---

## 3. 步骤 2：无设计稿时的页面结构

在导入外部设计稿之前，页面中的组件以**三层信息**组织：

### 3.1 数据结构

```jsonc
{
  "pageId": "dashboard",
  "name": "仪表盘",
  "components": [
    // === 语义树（父子层级关系）===
    {
      "componentId": "header",
      "type": "Container",
      "children": [
        { "componentId": "logo", "type": "Image", ... },
        { "componentId": "navMenu", "type": "Navigation", ... }
      ]
    },
    {
      "componentId": "mainContent",
      "type": "Container",
      "children": [
        { "componentId": "toolbar", "type": "Toolbar", ... },
        { "componentId": "dataTable", "type": "Table", ... }
      ]
    },
    {
      "componentId": "footer",
      "type": "Container",
      "children": [
        { "componentId": "copyright", "type": "Text", ... }
      ]
    }
  ],

  // === 逻辑分区（粗粒度区域划分）===
  "zones": [
    {
      "id": "header_zone",
      "label": "顶部导航区",
      "componentIds": ["logo", "navMenu"],
      "description": "包含品牌 Logo 和主导航菜单"
    },
    {
      "id": "main_zone",
      "label": "主内容区",
      "componentIds": ["toolbar", "dataTable"],
      "description": "页面的核心操作和数据展示区域"
    },
    {
      "id": "footer_zone",
      "label": "底部区域",
      "componentIds": ["copyright"],
      "description": "版权信息和辅助链接"
    }
  ],

  // === 布局建议（纯文字）===
  "layoutHint": "经典后台布局：左侧固定宽度侧边栏 240px，顶部通栏 header 56px，\n主内容区域自适应填充剩余空间，内容区内表格占满宽度"
}
```

### 3.2 三层信息的职责

| 层 | 内容 | 谁填写 | 用途 |
|---|------|--------|------|
| **components[]** | 语义树（Component 父子层级） | PM/AI 对话生成 | 定义页面有哪些元素、它们的层级关系 |
| **zones[]** | 逻辑分区（粗粒度区域划分） | PM/AI 定义 | 给第三方设计工具提供区域划分建议 |
| **layoutHint** | 布局建议（自由文本） | PM 自由描述 | 传达 PM 对布局的意图和想法 |

### 3.3 zones[] 与 conventions[] 的关系

- **zones[]** 是**页面级**的轻量区域划分，每个 Page 独立定义
- **conventions[]**（预留，详见 docs/05-object-lifecycle.md 第 8 章）是**项目级**的组合规范，定义可复用的组合模式（如「标准模态框 = Modal + 确认按钮 + 取消按钮」）
- zones[] 是 conventions[] 在页面级的**前驱实践**——未来 conventions[] 成熟后，zones[] 可升级为 conventions 实例的引用

---

## 4. 步骤 3：导出设计骨架 + 步骤 4：导入与映射

### 4.1 导出内容（给第三方设计工具）

系统通过 MCP/API 将「设计骨架」导出给第三方设计工具，内容分五个层级：

| 层级 | 内容 | 示例 | 设计师获得的信息 |
|------|------|------|-----------------|
| **页面级** | Page 清单、组件树、组件类型与属性 | `Dashboard` 页有 `Header`/`Sidebar`/`Table`/`Toolbar` | 「要画什么」 |
| **分区级** | zones[] + layoutHint | header/main/sidebar/footer + 布局建议文本 | 「大致怎么分区」 |
| **交互级** | 交互逻辑摘要 | 「点击搜索按钮 → 触发筛选 → 刷新表格数据」 | 「行为意图」 |
| **数据级** | 数据模型引用 | `Order` 实体有 `id/status/amount/createdAt` 字段 | 「数据上下文」 |
| **项目级** | 领域模型、后台处理逻辑等 | 全量项目上下文 | 「业务全貌」 |

#### 渐进式披露机制

项目级信息（领域模型、后台逻辑等）不一定在初始导出时全部打包。系统提供 **API/MCP/CLI 接口**支持渐进式披露：

```
初始导出：页面级 + 分区级 + 交互级 + 数据级（核心骨架）
        ↓
按需请求：项目级详细信息（通过 API/MCP/CLI 按需拉取）
        ↓
完整上下文：第三方设计 AI 可获取到完整项目信息做出更好的设计决策
```

### 4.2 支持的导入格式

| 格式 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| **HTML/CSS** | 可解析 DOM 结构，支持交互式预览，精确选择器 | 依赖 HTML 质量 | Web 类原型、代码生成类工具输出 |
| **图片 (PNG/JPG/SVG)** | 通用性最强，任何设计工具都能导出 | 需要 AI 视觉识别，精度依赖模型 | Figma/Sketch 截图、手绘草图、扫描件 |

不支持原生设计工具文件（Figma .fig / Sketch .sketch）—— 解析复杂度太高，且这些工具都能导出 HTML 或图片。

### 4.3 映射机制

#### 4.3.1 映射粒度

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **组件级（默认）** | 一个 Component → 设计稿中一个连续区域 | 大多数场景 |
| **子元素级（可选）** | Component 内部的子元素分别映射到不同区域 | PM 需要对特定组件定义精细交互逻辑时 |

#### 4.3.2 映射逻辑模式

| 模式 | 行为 | 适用场景 |
|------|------|---------|
| **Mode A：严格映射** | 以系统预定义的 Component 树为基准，AI 只做区域识别和锚点关联 | PM 对页面结构已有明确想法 |
| **Mode B：智能建议** | AI 在映射的同时分析设计稿内容，对组件架构提出调整建议（增/删/改组件、调整层级），PM 可采纳或否决。若采纳，系统修改自身的 Schema 数据 | 设计稿中出现系统未预见的元素，或结构需要优化 |

#### 4.3.3 Mode B 工作流细节

```
PM 选择 Mode B 导入设计稿
        ↓
AI 执行两个并行任务：
  ① 区域识别 → 建立 Component ↔ 设计稿区域的映射
  ② 架构分析 → 对比设计稿内容与现有 Component 树
        ↓
AI 输出建议报告：
  ├── 新增建议：「设计稿中有『用户头像』区域，系统中无对应组件，建议新增 Avatar 组件」
  ├── 调整建议：「搜索框和筛选按钮在设计稿中位于同一行，建议将它们归入同一个 Toolbar 容器」
  └── 删除建议：「系统中有『广告位』组件，但设计稿中未出现，建议确认是否保留」
        ↓
PM 逐条审阅：
  ├── 采纳 → 系统自动修改 Component 树 Schema
  ├── 否决 → 保持原有结构
  └── 修改 → PM 手动调整后确认
        ↓
最终映射结果写入各 Component.layout
```

---

## 5: Component.layout 字段 Schema（多态结构）

### 5.1 完整 Schema

```jsonc
//=== 场景 A：来源是 HTML/CSS ===
{
  "layout": {
    // --- 基本信息 ---
    "sourceType": "html",                    // 枚举："html" | "image" | null
    "sourceId": "imported_design_v1",         // 导入批次/设计稿 ID

    // --- 位置锚点（多态）---
    "selector": "#login-form > button.submit-btn",  // HTML: DOM 选择器

    // --- PM 布局意图 ---
    "hint": "登录按钮应放在表单底部居中位置，宽度与输入框等宽",

    // --- 导入后校验结果（系统自动填充）---
    "validation": {
      "status": "warning",                   // "ok" | "warning" | "mismatch"
      "deviation": "按钮位于右下角而非居中，宽度约为输入框的 80%",
      "checkedAt": "2026-04-27T10:30:00Z"
    },

    // --- 降级方案（可选）---
    "fallbackRegion": {
      "type": "boundingBox",
      "x": 0.5, "y": 0.75,                  // 归一化坐标 (0~1)
      "width": 0.15, "height": 0.06
    }
  }
}

//=== 场景 B：来源是图片 ===
{
  "layout": {
    "sourceType": "image",
    "sourceId": "dashboard_mockup_v2",

    // --- 位置锚点（多态）---
    "region": {
      "type": "boundingBox",                 // 或 "svg_path" 用于不规则形状
      "x": 0.12, "y": 0.35,                  // 归一化坐标 (0~1)
      "width": 0.76, "height": 0.52
    },
    "confidence": 0.92                       // AI 识别置信度 (0~1)

    // --- PM 布局意图 ---
    "hint": "数据表格应占据主内容区的主体空间，至少占 70% 宽度和 80% 高度",

    // --- 校验结果 ---
    "validation": {
      "status": "ok",
      "deviation": null,
      "checkedAt": "2026-04-27T11:00:00Z"
    }
  }
}

//=== 场景 C：尚未导入设计稿 ===
{
  "layout": null                             // 或字段不存在
}
// 但仍可有 hint（规划阶段的布局想法）:
// "layout": { "sourceType": null, "hint": "..." }
```

### 5.2 字段详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sourceType` | enum | 是 | `"html"` / `"image"` / `null` |
| `sourceId` | string | 条件必填 | sourceType 非 null 时必填，指向 designArtifacts[] 中的条目 |
| `selector` | string | 条件必填 | sourceType=html 时使用，CSS/DOM 选择器 |
| `region` | object | 条件必填 | sourceType=image 时使用，包含 type/x/y/width/height 或 svg_path |
| `confidence` | number | 可选 | sourceType=image 时，AI 识别置信度 0~1 |
| `hint` | string | 可选 | PM 对此组件的布局意图（纯文本），用于导出指导和导入校验 |
| `validation` | object | 可选 | 导入后的校验结果，含 status/deviation/checkedAt |
| `fallbackRegion` | object | 可选 | DOM 解析失败时的视觉降级方案（归一化 boundingBox） |

### 5.3 hint 字段的完整生命周期

```
步骤 2（规划时）
  PM/AI 填写 hint → 表达对此组件的布局意图
       ↓
步骤 3（导出时）
  hint 随设计骨架一起发给第三方设计工具 → 指导其设计决策
       ↓
步骤 4（导入后）
  系统 AI 比较 hint 与实际识别结果 → 自动生成 validation 报告
       ↓
迭代循环
  PM 查看 validation → 决定是否要求设计工具调整 → 重新导入 → 更新 validation
```

这个闭环实现了**「意图→设计→校验→修正」**的质量保障机制。

---

## 6: 运行时渲染（双模式 + 双格式）

### 6.1 两种运行模式

#### 原型介绍模式（主模式 —— 最常用）

这是原型系统的**核心使用模式**。

**用途**：PM 日常编辑、审查、向 stakeholder 讲解原型

**呈现内容**：
- 本页面涉及的**领域对象**及其关系
- **信息架构**是什么样的
- 每个区域分别对应高保真原型的哪里（可视化映射）
- 本页面的**详细交互逻辑说明**（从页面加载开始，包括页面及所有子元素的 Hook、数据绑定、业务规则等，全部翻译成人类可读的原型逻辑说明文档）

**交互行为**：
- 用户点击/选择某个被识别出的组件 → 观察/编辑该组件的详细设置
  - 更改文案（label/text/content）
  - 编辑 Hook 逻辑
  - 修改数据绑定
  - 调整业务规则引用
- **不运行原型**，只做解释和元数据的编辑

> **关于介绍模式的详细 UI 布局设计**：延后到具体功能设计阶段再展开讨论。当前只需知道其核心特征——以逻辑说明和元数据编辑为主，不以运行为主。

#### 原型演练模式（辅助模式）

**用途**：PM 在编辑完成后想要预览效果，或以「贴近产品真实运行状态」的方式做演示

**呈现内容**：
- 不展示解释性内容
- 以浏览器运行 HTML 的方式运行原型
- 用户可与原型进行真实交互

**交互行为**：
- 点击按钮 → 触发该组件注册的 Hook 函数
- Hook 执行时提供 **Mock 实现**：
  - 后台 API 调用 → 返回预设 Mock 数据
  - 数据模型读写 → 使用临时存储的示例数据（如自动生成 10 个随机订单用于演示订单列表页）
  - 页面跳转 → 模拟路由切换

### 6.2 两种格式的渲染方式

| 导入格式 | 介绍模式 | 演练模式 |
|---------|---------|---------|
| **HTML/CSS** | 展示 HTML + 组件边界高亮（基于 selector 定位） | JS 注入事件监听器到对应 DOM 节点，用户直接与 HTML 交互 |
| **图片 (PNG/JPG/SVG)** | 展示图片 + 半透明热区 Overlay（基于 boundingBox 绘制组件边界） | 图片上覆盖透明热区层，用户点击热区 → 系统根据坐标匹配 Component → 触发对应 Hook 逻辑 |

### 6.3 已知限制（延后处理）

#### 静态图片动态更新问题

**现象**：演练模式下，如果导入的是静态图片（如一个包含 2 行订单数据的表格截图），当原型运行时需要动态展示数据变化（如新增一行订单后应显示 3 行），静态图片无法实时更新。

**原因**：高保真图片是静态导入的，不是本系统通过布局引擎实时生成的。本系统在当前阶段不做布局渲染。

**状态**：记录为此设计的**已知限制**，留待未来某个阶段考虑解决方案。可能的解决方向（仅供参考，不在此阶段决策）：
- 仅对 HTML/CSS 来源启用完整的动态演练模式
- 对图片来源提供「有限动态更新」（如数值替换但不改变布局结构）
- 未来引入轻量布局引擎仅用于演练模式的数据驱动渲染

---

## 7: Project JSON 结构变更

### 7.1 新增/修改节点总览

```jsonc
{
  "project": {
    // ===== 现有结构（不变）=====
    "name": "...",
    "domainModel": { ... },
    "applications": [...],

    // ===== 新增：导入的设计稿管理 =====
    "designArtifacts": [
      {
        "id": "da_001",                        // 唯一标识
        "type": "html" | "image",              // 格式类型
        "name": "仪表盘高保真 v1",              // 人类可读名称
        "sourceUrl": "/uploads/design_v1.html", // 文件引用路径
        // 或 sourceData: "..." (内联数据，适用于小尺寸图片)
        "pageMapping": [                       // 设计稿 → 页面的映射关系
          {
            "pageId": "dashboard",
            "mappedAt": "2026-04-27T10:00:00Z",
            "mappingMode": "strict" | "adaptive"  // Mode A 或 B
          }
        ],
        "importedAt": "2026-04-27T10:00:00Z",
        "version": 1,
        "metadata": {                           // 可选：扩展元数据
          "sourceTool": "Figma",               // 来源工具
          "exportedBy": "pm_user_001",         // 导入操作人
          "fileSize": 245000,                  // 文件大小(bytes)
          "dimensions": { "width": 1920, "height": 1080 }  // 尺寸(图片)
        }
      }
    ],

    // ===== applications[].pages[] 变更 =====
    "applications": [{
      "pages": [{
        "pageId": "dashboard",

        // --- 现有：components[] 语义树（每个 Component 新增 layout 字段）---
        "components": [
          {
            "componentId": "loginButton",
            "type": "Button",
            // ... 其他属性 ...

            // 【新增】layout 字段
            "layout": {
              "sourceType": "html",
              "sourceId": "da_001",
              "selector": "#login-form > button.submit-btn",
              "hint": "登录按钮居中放置，与输入框等宽",
              "validation": { "status": "ok", ... }
            }
          }
        ],

        // 【新增】逻辑分区
        "zones": [
          {
            "id": "header_zone",
            "label": "顶部导航区",
            "componentIds": ["logo", "navMenu"],
            "description": "包含品牌 Logo 和主导航菜单"
          }
        ],

        // 【新增】页面级布局建议
        "layoutHint": "经典后台布局：左侧固定侧边栏 240px..."
      }]
    }]
  }
}
```

### 7.2 变更清单汇总

| 位置 | 变更类型 | 节点 | 说明 |
|------|---------|------|------|
| Project 根级 | **新增** | `designArtifacts[]` | 导入的设计稿管理列表 |
| Page 级 | **新增** | `zones[]` | 逻辑分区定义 |
| Page 级 | **新增** | `layoutHint` | 页面级布局建议（纯文本） |
| Component 级 | **新增** | `.layout` | 多态布局映射字段（sourceType/selector or region/hint/validation） |

### 7.3 向后兼容

- 所有新增字段均为可选（optional）
- 无设计稿时 `layout` 为 `null` 或不存在，`zones` 为空数组 `[]`，`designArtifacts` 为空数组
- 已有 Project JSON 无需任何迁移即可兼容新结构

---

## 8: 总结与待办

### 8.1 本设计与其它设计文档的关系

| 关联文档 | 关系类型 | 说明 |
|---------|---------|------|
| **docs/03-semantic-layer-schema.md** | 基础 | 定义了 Component 的基础 Schema，本文在其上扩展 `layout` 字段 |
| **docs/04-app-shared-resources.md** | 并行 | 定义 App 级共享资源（数据模型/角色/规则等），本文的导出内容引用这些资源 |
| **docs/05-object-lifecycle.md** | 互补 | 生命周期定义交互逻辑的**表达方式**，本文定义这些逻辑**附着在哪个视觉区域** |
| **Task 1.8 组件库规划** | 独立 | 组件库定义「有哪些组件、长什么样」，本文定义「组件如何与外部设计稿关联」 |
| **conventions[]（预留）** | 前驱-演进 | conventions 定义项目级组合规范，`zones[]` 是其在页面级的轻量前驱 |

### 8.2 核心设计决策汇总

| # | 决策 | 理由 |
|---|------|------|
| 1 | **系统不做布局引擎** | 聚焦核心价值（语义/逻辑管理），布局委托给专业工具 |
| 2 | **页面结构 = 语义树 + zones + layoutHint** | 三层信息分离：结构、分区、意图 |
| 3 | **layout 字段多态结构** | HTML 用 selector，图片用 boundingBox/svg_path，统一接口 |
| 4 | **hint + validation 闭环** | 意图→设计→校验→修正的质量保障 |
| 5 | **双模式映射（严格/智能建议）** | 兼顾控制灵活性（Mode A）和 AI 辅助提效（Mode B） |
| 6 | **双粒度映射（组件级/子元素级）** | 默认简单，按需精细 |
| 7 | **运行时双模式（介绍/演练）** | 介绍模式为主（日常使用），演练模式为辅（演示用） |
| 8 | **工作流独立文档** | 工作流内容会持续增长，需要独立管理 |
| 9 | **静态图片动态更新延后** | 当前阶段已知限制，未来考虑解决方案 |

### 8.3 待办项

| # | 待办 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | **新建 workflow 文档** | P0 | `docs/workflow.md`，专门管理系统使用工作流，后续持续补充 |
| 2 | **补充工作流细节** | P1 | 步骤 3 导出 API 规格、步骤 4 AI 映射 prompt 策略、步骤 5 介绍模式 UI 布局 |
| 3 | **介绍模式详细设计** | P2 | 用户明确表示延后讨论，等到具体功能设计阶段 |
| 4 | **静态图片动态更新** | P3 | 已知限制的未来解决方案 |
| 5 | **designArtifacts 版本管理** | P2 | 多版本设计稿的 diff 查看、回滚等 |
