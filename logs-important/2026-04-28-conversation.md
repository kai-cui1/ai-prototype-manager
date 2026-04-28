# 讨论日志 — 2026-04-28

> **主题**：业务流程系统 v1.1 深入设计（创建工作流 + 数据流模型 + 流程架构）
> **承接**：上一轮（2026-04-27）完成了业务流程系统 v1.0 核心设计（三层架构、节点/边/参与者 Schema），本轮继续三个待设计议题
> **产出**：`docs/08-business-process.md` 从 v1.0 (595行) 更新至 v1.1 (972行)，新增 29 项设计决策

---

## 议题一：Graph 创建与维护工作流

### Q1: 底层有向图的创建模式？

**选项**：
- A: AI 先生成初稿 + PM 审核修改
- B: PM 逐步引导 + AI 逐步构建
- C: 混合模式

**PM 选择：C — 混合模式**
> 简单流程用 AI 初稿模式；复杂/关键流程用逐步引导模式；PM 可随时切换

---

### Q2: 一个 Project 下多个 Graph 的拆分依据？

**PM 回答（关键架构澄清）**：

> 其实不存在「拆」的概念。我来描述下：
>
> 1. **一个 Project 下有一个流程表，一个节点表**。所有的节点（行动节点、边节点、判断节点）都在节点表保存，这是底层核心数据。节点表忠实表达了项目中的用户(Role)、系统(Applications)以及外部对象(车、设备)之间的互动关系和信息传递。**底层节点的表达不是按照流程视角去组织的，而是原子化的**。比如：角色：管理员的一个行为：创建用户，这个行动节点在底层表里只会有一条记录（不管他出现在多少个流程图里）
>
> 2. **流程表里的信息，就是所谓的「图」**。因为只有底层的节点，我们缺乏一个视角去「欣赏」这个流程，所以才有了「流程」的概念。所谓流程，其实就是从所有的行动节点里，选1个开始，若干个结束节点，以及过程中流经的所有节点、边，本流程只保存流程和这些原子元素的对应关系，以便于在「流程图展示」的时候只展示被选中的这部分信息
>
> 3. **从实际操作的角度**：先建立1个流程图对象，此时流程图是空的，然后「画」流程图的过程，实际上应该是不断从已有底层行动节点里「选」节点的过程。如果没有，则新建。（比如，一个空的流程图，我先把2个Role、1个application拖进来，形成「泳道」，然后开始在Role里新建一个Action，此时就应该从Role已经定义好的Action里下拉选择可用的行为，如果没有合适的，则可以给Role新增一个Action）
>
> 4. **当一个流程图设计完毕**，产生的效果是：a) 给底层的节点表新增了一些之前没有的对象行为；b) 流程图对象关联了一堆的底层行动节点ID、边ID、分支节点ID，并且标记了起始节点是哪个、终止节点是哪几个
>
> 5. **关于「拆分」**：本质上是用户对流程里包含的节点的重新选择。比如原先1个流程有100个节点，现在用户新建了3个新子流程，变成了1+3个子流程，上层流程节点拥有下层3个子流程节点，3个子流程分别拥有30,30,40个节点。这样就完成了所谓的「拆分」

**核心结论**：
- **取消 Graph 实体** —— 不再有独立的 `Graph[]` 数组
- 节点+边在 Project 根级全局池：`processNodes[]` + `processEdges[]`
- Process 仅存引用 ID（不拥有数据）
- 节点全局唯一（一个 Action 全局只有一条记录）

**补充（PM）**：
> 流程图编辑的过程中，也可以进行边的创建。如果2个节点之间原本已经有边，那么在这两个节点被拉入流程图的一刻，这个边就会自动加载进来。**边的唯一性，是由 src、target 决定的**

---

### Q3: 数据模型调整方式？

**PM 选择**：节点和边提升到 Project 根级全局池 + Process 仅引用 ID。取消 Graph 实体。

---

### Q4: Activity 节点如何创建？

**PM 选择**：泳道 + Action 下拉选择（推荐）
> PM 在泳道中右键 → 新增活动节点 → 选择 holder → 从该参与者已有 Action 下拉选择 → 如无合适 Action 则就地新建。AI 根据 Action 的 inputs/outputs 自动推导初始 payload.mappings

---

### Q5: Decision 节点如何创建？边如何创建？

**Decision 创建（PM 详细回答）**：

> PM 在泳道中右键 → 新增判断节点 → 选择 holder → 选择holder需要做的逻辑判断(没有可以新增) → 若是新增判断，则输入判断行为的名称 → 逐行添加分支判断条件，并将对应判断分支branch的出口节点，连接到下一个节点。
>
> **注意**：
> 1. 所有泳道对象，可能除了Action之外，还得保存一个**逻辑判断行为集合**，每个判断行为的内部结构，就是我们Decision的结构。
>
> **延伸思考**：
> 1. 本质上，流程图里的分支逻辑，其实是某个对象在进行某个活动的内部logic的一个判断过程，其实这部分信息在logic里应该有体现
> 2. 传统流程图之所以要专门设计判断分支，是因为有一些关键的判断在流程里格外重要

**边创建（PM 选择）**：拖拽连接 + AI 自动映射
> PM 从源节点拖拽到目标节点 → 系统自动弹出配置面板：选择 source action/target action → 流程编辑器自动根据 2个Action 的 I/O类型 自动填充 payload.mappings → PM 确认或修改

**重大发现：decisions[] 对称模型**

PM 的回答暗示了一个新模型：**三类参与者（Role/Service/ExternalEntity）都有 `decisions[]` 集合，与 `actions[]` 完全对称**。

---

### Q6: decisions[] 是否对所有三类参与者都适用？

**PM 选择**：确认，完全对称模型（推荐）
> Role/Service/ExternalEntity 都有 decisions[] 集合，DecisionNode 通过 decisionRef 引用。与 Action/actionRef 完全对称

---

### Q7: 可视化呈现形式？

**PM 回答**：

> 底层节点、边，通常是通过上层的流程图对象关联查询出来之后呈现的，这种模式下，呈现逻辑为：
> **横轴为流程步骤（时间/顺序），纵轴为参与者泳道（Role/Service/ExternalEntity）。节点放在对应泳道中，边跨泳道连接。这是最经典的业务流程图形态**
>
> 但是如果系统用户想要直接探查底层所有的节点、边信息，我觉得我们可以考虑增加一个【**业务活动基础库管理**】功能，有2种视图：
> 1. **表格视图**：分别表格方式查看所有行为节点、边节点、分支判断节点
> 2. **图形视图**：有点像知识图谱的那种展示方式，系统根据所有活动节点的元数据信息、边信息、自动生成一个关系图谱，用户可以点击里面的一个节点，或者边，侧边栏显示节点的详细信息

**结论**：双层可视化 —— 主视图(泳道流程图) + 辅助视图(业务活动基础库: 表格+关系图谱)

---

### Q8: AI 辅助能力？（多选）

**PM 选择**：自然语言批量生成流程片段 + 完整性校验与提示
> 先考虑这两种场景即可，前期我们不做太多复杂AI功能，先打通系统流程，后续可以完善AI

---

## 议题二：变量系统 / 数据流模型

### Q9: payload.variables 是什么？

**背景**：之前设计中 Edge.payload 有两种数据传递：
- `mappings`: 源 Action output → 目标 Action input
- `variables`: 直接传递流程级变量（不经过 Action I/O）

**PM 反馈**：没理解 variables 的含义 → 触发重新审视

**讨论结果**：
- **删除 `payload.variables`** —— 统一走 mappings 纯管道模型
- 不要流程级常量
- 所有数据通过 Action I/O + Edge mappings 流动

---

### Q10: 纯管道模型是否足够？

**PM 回答**：还需要补充

> decision本身的不同branch，也是有output参数的（否则下游的edge连接就没有payload可以携带），其参数默认从进入decision的所有edge边的payload里选择（也可以新增新的参数），所以**branch是需要保存本分支下，对下游输出的参数清单**

**核心发现：DecisionBranch.outputs**

```
Incoming Edge(s) ──mappings──→ Decision 接收输入数据
                              │
                        判断条件评估
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
            Branch A      Branch B    Branch C
            outputs[]    outputs[]   outputs[]
            (参数清单)    (参数清单)   (参数清单)
                  │           │           │
                  ▼           ▼           ▼
            Outgoing Edge  Outgoing Edge Outgoing Edge
            .mappings      .mappings   .mappings
```

**outputs 的来源规则**：
- **默认继承**：从进入 Decision 的所有入边的 payload 中选择字段
- **可新增**：分支可新增自己的输出参数（如 `"result": "approved"`）

---

### Q11: DecisionBranch 增加 outputs 字段是否正确？

**PM 选择**：确认，branch 有 outputs（推荐）
> DecisionBranch 增加 outputs: NodeIO[]，decision→activity 的 edge.mappings 数据来源是 branch.outputs（而非 Action.outputs）

---

### Q12: 除了 DecisionBranch.outputs 之外还有其他需要补充的吗？

**PM 选择**：仅此一项，其余纯管道（推荐）

**最终数据流模型**：
- 唯一数据路径：Action output → Edge.mappings → Action input
- 唯一补充：DecisionBranch.outputs（decision→activity 边的数据来源）
- 没有：variables、流程级常量、全局上下文、状态变量

---

## 议题三：ProcessArchitecture 完整设计

### Q13: ProcessArchitecture 的主要用途？

**PM 选择**：流程分类导航（推荐）
> 类似文件目录/组织架构图，把大量流程按业务域→子域→具体流程的层级组织起来

---

### Q14: 层级深度？

**PM 选择**：不限层数，PM 按需创建层级
> 简单项目可能 2 层，复杂项目可能 4-5 层

---

### Q15: 架构树节点内容？

**PM 回答（重要区分）**：

> 这是一个好问题，让我们深入探讨一下。之前我们聊过，「流程」这个对象可以自我嵌套（包含子流程），且这种嵌套关系在流程图的展示上可以表达出来。我们定义1个流程/子流程，在它的上一层流程（父级流程）的视角下查看的时候，自己这个子流程的第一个节点的Holder就成为了这个子流程的「代表Holder」，负责在上级流程展示的时候，显示在合适的泳道内。
>
> 而**流程架构某种程度上也存在这种上下级关系，但这种关系更多是从架构组织层面的，而不是实际的流程事实的包含关系角度**

**两种「层级关系」的本质不同**：

| | 流程嵌套（Process 内部） | 架构组织（ProcessArchitecture） |
|---|---|---|
| 性质 | 执行事实的包含关系 | 纯分类导航关系 |
| 含义 | 父流程执行时调用子流程 | 只是方便找流程的文件夹 |
| 可视化 | 子流程在父流程中显示为**一个节点** | 树形目录，点击叶子打开具体流程 |
| 数据影响 | 影响流程执行语义 | 不影响任何执行语义 |

**PM 最终选择**：非叶子也可引用概览 Process

---

### Q16: 架构树如何维护？

**PM 选择**：纯手动

---

### Q17: 同一 Process 可否出现在多处？

**PM 选择**：允许（推荐）
> 架构是视图，不影响底层

---

## 写文档

**PM 选择**：写文档（推荐）

### 文档更新操作

对 `docs/08-business-process.md` 进行了全面更新（v1.0 → v1.1）：

#### 主要变更清单

1. **版本号/状态/日期更新** — v1.0 → v1.1，日期扩展至 2026-04-28
2. **核心哲学更新** — 「底层是有向图的集合」→「底层是全局原子节点池+边池（无独立图实体）」
3. **三层架构总览图重绘** — Layer 1 从 "Graphs" 改为 "全局节点池+边池"，Layer 3 标注新特性
4. **设计原则 11→13 条** — 新增：全局池即真相、节点原子且唯一、Decision与Action对称、边由(source,target)确定、纯管道数据流等
5. **Layer 1 全面重写**：
   - 取消 `Graph` 接口定义
   - `GraphNode` → `ProcessNode`（ActivityNode + DecisionNode）
   - ActivityNode 增加 `decisionRef` 对称说明
   - DecisionNode 新增 `decisionRef` 字段（引用 Participant.decisions[id]）
   - `GraphEdge` → `ProcessEdge`
   - 删除 `payload.variables`
   - 四种边形态更新（统一 mappings）
   - 新增边唯一性规则
6. **参与者章节全面重写**：
   - 新增通用 `DecisionDef` / `DecisionBranchDef` 接口定义（含 outputs 字段）
   - Role 新增 `decisions: DecisionDef[]`
   - Service 新增 `decisions[]` 和 `ServiceDecision`
   - ExternalEntity 新增 `decisions: DecisionDef[]`
   - 参与者汇总表增加 decisions 列
   - ExternalEntity 示例更新（含 decisions 示例）
7. **Layer 2 Process 更新**：
   - 取消 `sourceGraphId` 字段
   - 新增「仅引用」约束
8. **ProcessArchitecture 从「待设计」升级为完整设计**：
   - 6 项设计决策
   - 与 subProcess 的区别说明
   - 完整数据结构（ArchitectureNode 含 processRef）
   - 节点类型说明（纯分类文件夹 vs 概览节点 vs 叶子）
   - 工业控制系统示例架构（含多位置引用示例）
9. **新增章节：图创建与维护工作流**：
   - 混合模式定义
   - 5 步核心交互（创建空流程→构建泳道→添加Activity→添加Decision→创建边）
   - 每步详细交互路径和关键规则
   - 双层可视化架构表
   - AI 辅助能力两场景
10. **新增章节：数据流模型**：
    - 纯管道原则和完整数据流图
    - 明确「没有的东西」列表
    - DecisionBranch.outputs 唯一补充详解
    - 完整数据流示例（含 decision→activity 场景）
11. **Project JSON 位置映射更新**：
    - 新增 `processNodes[]`、`processEdges[]`、`processArchitecture?`
    - 标注 decisions[] 在各参与者位置
12. **设计决策汇总从 15 条扩展到 29 条**（分 5 个类别）
13. **待设计议题更新**：7 项中 6 项标记完成，剩余 3 项（subProcess/循环约束/运行时追踪）

#### 同步更新的文件

| 文件 | 变更 |
|------|------|
| `docs/01-design-idea/01-design-idea.md` | 业务流程模块标记为 ✅ 完成 |
| `memory/project_progress.md` | 进度 69%→77%(10/13)，新增 Task 1.10 的 20 条决策 |

---

## 会话统计

- **讨论议题数**：3 大议题 + 17 个子问题
- **设计决策数**：29 项（新增 14 项）
- **文档变更**：docs/08-business-process.md 从 595 行增至 972 行（+377 行，+63%）
- **阶段进度**：概念设计阶段一 9/13 → **10/13 完成（77%）**
