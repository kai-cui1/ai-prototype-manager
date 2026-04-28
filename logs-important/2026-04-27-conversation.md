# 2026-04-27 对话记录

> Task 1.7「对象生命周期」交互范式定义 — 完整设计讨论与产出

---

## 对话概要

**任务：** Task 1.7「对象生命周期」交互范式定义（钩子类型、事件类型、action 类型体系）
**状态：** ✅ 完成
**产出物：** `docs/05-object-lifecycle.md`（971 行，9 个章节）
**阶段一进度更新：** 7/12 完成 (58%)

---

## 关键决策记录

### 决策 1：设计范围 → 全量设计
覆盖 7 个方面：事件分类、Hook 执行模型、条件语法、Action 全集、Schema 汇总、执行引擎、结构变更预留

### 决策 2：设计哲学 → 类 React 生态
参考现代前端框架生命周期概念，适配简化，Coding AI 天然理解

### 决策 3：对象覆盖 → 按组件类型分别定义
每种组件类型有独立的生命周期事件集合

### 决策 4：事件传播 → **不冒泡**，显式 API 通信
**重要讨论：**
用户提出质疑——原型系统是否需要关心事件传播机制？原型描述的是"什么"不是"怎么实现"。PM 的需求通常是"当 xx 被点击时调用某个后台处理"，不需要隐式的事件传播。
**结论：** 不设计事件冒泡。跨组件通信通过 `holder.triggerEvent()` 显式 API 完成。所有交互都是 PM/AI 刻意定义的显式链路。

### 决策 5：条件语法 → 纯 JS 表达式
condition.data 是返回 boolean 的 JS 表达式字符串，与 logic.data 风格统一

### 决策 6：多 Hook 执行 → **并行**
**用户的核心观点：** Hook 注册的多个事件是并行执行的，从语义上原型和实现方都无需保证多个注册函数的调用顺序。如果产品定义上需要多个任务串行，正确的使用方法应该是只注册一个 Hook，然后在处理函数里去串行调用多个后台处理任务。

### 决策 7：错误处理 → Hook 内自治 + 系统顶层兜底 + 展示层可解析 catch
**用户补充要求：** 本原型系统在展示交互原型逻辑说明的时候，需要能识别这些 catch 逻辑，转为可理解的描述文字。

### 决策 8：Modal 去掉 onConfirm / onCancel
**用户观点：** Modal 内部装载的内容是动态的，未来不一定是确认/取消按钮。这些事件不在模态框里定义，直接由 PM/AI 在 Modal 里具体组件的 click 事件去定义即可。
**结论：** Modal 仅保留 onOpen（感知被打开）和 onClose（感知被关闭）

### 决策 9（重大新发现）：项目交互规范层（conventions[]）
**用户的洞察：** 本系统在交互设计层面实现的是一套基本的交互原子组件，是人机交互的原语体系。具体用户创建一个项目+一个 application 后，需要先定义本项目的应用系统的基本交互规范。这个规范会基于原子组件组合产生适用于用户项目的更上层组合规范（如「标准模态框」= Modal + 确认按钮 + 取消按钮）。

**架构影响：**
```
原子组件（Modal/Button/Input）
     │  组合/约束/规范化
     ▼
项目交互规范（conventions[]）— 如「标准模态框」= Modal + 确认 + 取消
     │  使用
     ▼
页面设计
```

**处理方式：** 预留 + 延后设计。在 Project JSON 中预留 conventions[] 节点位置。

### 决策 10：conventions[] 放置位置 → 具体 application 下
**用户纠正：** conventions[] 应该放在具体某一类 application 下面，因为交互规范不能脱离具体应用形态去定义。Web 的标准模态框和 iOS/Android 的规范完全不同。

### 决策 11：customAction 逃生舱
**场景：** 当现有结构化 Action 无法表达某些操作时（第三方 API、平台原生能力、领域特有操作等）。
**规格：** `context.customAction(description, options?)` 作为 context 顶层独立方法。
**命名选择：** 用户选择 `customAction`（而非 noStructureAction/adHocAction/openAction）。
**放置位置：** 用户选择 context 顶层独立方法（而非 globalActions 中）。

---

## 设计文档章节结构（docs/05-object-lifecycle.md）

1. **整体架构与定位** — 系统职责边界、设计哲学、7 项核心决策汇总、不冒泡理由
2. **三层事件分类体系** — base(4) + capability(6类20个) + specific(组件特有)；各组件 lifeCycles 组合速查表；Modal 去掉 onConfirm/onCancel 的理由
3. **Hook 注册与执行模型** — 完整 Schema、字段规范、执行流程图、并行规则、函数签名规范、holder API
4. **条件表达式完整语法** — 纯 JS 表达式、可用上下文、常用模式速查、展示层可读性转换策略
5. **Hook 内可调用的 Action 类型全集** — 四渠道（globalActions/backgrounbizOp/holder/customAction）；triggerEvent 显式通信 API 完整规格；customAction 逃生舱完整设计
6. **系统执行引擎行为规范** — 引擎职责、启动流程、合法性校验、完整执行流程图、并行细节、兜底伪代码、展示层解析策略
7. **lifeCycles 元数据完整 Schema** — 含 layer/category 字段的三层分类标记
8. **Project JSON 结构变更与预留接口** — conventions[] 预留位置、兼容性检查、四种逻辑载体对比表（更新版）
9. **待后续议题** — conventions 完整设计（新高优任务）、1.8 组件库、Layout DSL 等

---

## 自检修复项

- triggerEvent 示例中的 `'onRefresh'` 事件未在 Table lifeCycles 中定义，改为合法的 `setState` 方式 + 注释说明替代方案

---

## 下次继续方向

1. **Task 1.8：标准组件库规划**（组件分类、属性 Schema、状态集、lifeCycles 定义）
2. **conventions[] 项目交互规范层完整设计**（新高优先级任务）
3. **Layout DSL 详细设计**（高优先级）
