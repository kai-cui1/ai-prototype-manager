# 2026-06-15 重要对话：AI Agent 集成设计

## 会话主题

围绕"外部团队 AI agent 如何高效、安全、可落地地利用本系统能力"进行产品架构层面的深入讨论。

## 核心决策记录

1. **D-1**: 用"Design AI / Implement AI"替代"上游/下游"划分。Implement AI 包含 Coding/文档/测试等多种子类型。
2. **D-2**: Implement AI 的输出格式不由系统预先固定，由消费方自适应。
3. **D-3**: 本系统定位为两层之间的"单一事实来源"（Single Source of Truth）。
4. **D-4**: MCP Server 是外部 AI 集成的核心交付物。
5. **D-5**: MCP tool description 质量是成败关键。
6. **D-6**: System Prompt 模板与 MCP Server 同等优先。
7. **D-7**: 识别三类高危误用区域（流程节点/边依赖、删除级联、Decision 分支绑定）。
8. **D-8**: 约束保障采用 A+B+C 分层组合（服务端硬约束 / MCP 增强返回 / System Prompt）。
9. **D-9**: MCP Server 以 Sidecar 形态独立部署（dev1:13182）。
10. **D-10**: 本系统是被动工具，不是协作主场。
11. **D-11**: MCP 层不做前置拦截，改用"增强返回"（sideEffects 提示）。
12. **D-12**: System Prompt 以配置模板形式交付（用户粘贴到 AI 客户端配置）。
13. **D-13**: Design AI MVP 采用四步体验驱动节奏。
14. **D-14**: Level 0 快照必须包含引用级关键属性（不只是 actionCount 数字）。
15. **D-15**: Design AI 需要三层信息支撑（概念元信息 + 操作依赖规则 + 引用级属性）。

## 关键讨论内容

### 双层定位
- Design AI：定义层，与 PM 协作，操作领域概念
- Implement AI：实现层，消费语义原型产出各种产物（代码/文档/测试/运维配置）

### Implement AI 的切面输出
不同类型 Implement AI 需要不同的横截面：文档 AI、Coding AI、测试 AI、运维 AI

### Design AI 接口评估
- 现有 60+ CRUD 覆盖"逐步构建"场景
- 三类缺口：上下文感知（getProjectSnapshot）、影响预估（previewImpact）、批量事务（batchExecute）
- 后续修正：batchExecute 优先级降低（外部 agent 可自行编排），场景化聚合接口不需要

### 概念理解与对齐
- 通用概念 AI 都懂（Entity/Process/Role 等）
- 系统特有约定 AI 无先验知识（mappings/ActionRef/语义层分离）
- 需要 System Prompt 配置模板来注入概念说明和操作规则

### 交互模型修正
- 原假设：AI 需要我们提供编排能力 → 修正为：本系统只是被动工具
- 原假设：MCP 层做前置拦截 → 修正为：增强返回（sideEffects）
- 原假设：System Prompt 由我们注入 → 修正为：配置模板交付给用户

### MCP Tool Description 高危误用分析
1. 节点先于参与者创建（holder 不存在）
2. 边的 mappings 被省略或方向反
3. ActionRef vs Action 的混淆
4. 删除操作的级联影响
5. Decision 分支与边的绑定不一致

### Level 0 快照修正
- 原设计只返回数字（actionCount），AI 无法引用
- 修正后返回引用级属性（id/name/displayName/参数概要）

### MVP 四步开发节奏
1. 项目快照 API
2. MCP Server 骨架 + 5-8 核心 tools
3. 实际体验（Claude Code 连接 MCP）
4. 反馈补齐（剩余 tools + previewImpact + System Prompt 模板）

## 产出文档

`docs/01-design-idea/ai-agent-integration.md` — 包含完整的设计框架、15 条决策记录、三个业务流程场景、四个交互模式、数据流图
