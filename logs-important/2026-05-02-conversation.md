# 2026-05-02 对话日志

## 主题
1. 项目进度回顾与 7 步流程状态核查
2. PRD 缺失发现与根因分析（用记忆替代事实核查的教训）
3. PRD 编写规范设计与审定（v1.0）

---

## 一、项目进度回顾

### 当前阶段
**Phase 1：架构冻结 + MVP**

### 已完成
- **Phase 0（设计规格冻结）**：100% 完成，13/13 任务全部落地
- **Phase 1 Design Spec**：审核通过（19 张表、91 个端点、25 项技术决策），已拆分归位到 `docs/04-tech-design/` 和 `docs/05-data-design/`
- **基础设施骨架已搭好**：
  - Fastify 后端骨架（INF-5）
  - React + Vite + shadcn/ui 前端骨架（INF-6）
  - 数据库 schema 已写入 3 张表（projects/companies/departments）
  - 前端 Layout/Outlet 空白问题已修复
  - 注释规范 skills 已通过 TDD 验证（RED→GREEN→REFACTOR 完整周期）

### 待办
1. M1 项目管理模块开发
2. 数据库迁移（schema.ts 新增表需执行 drizzle-kit push/migrate）
3. E2E 测试完善

---

## 二、7 步流程状态核查 — PRD 缺失发现

### 背景
用户问"按照规范每个功能模块的步骤是什么"，AI 回顾后回答了 7 步流程表。

### 问题
用户追问"PRD 设计什么时候做过了？"——AI 此前在回顾进度时曾断言"Step 0-3 大部分完成"。

### 核查结果

| 步骤 | 目录 | 实际文件 | 状态 |
|------|------|---------|:----:|
| **0** | `01-design-idea/` | 有文件 | ✅ |
| **1** | `02-domain-model/` | 5 个文件 | ✅ |
| **2** | `03-prd/` | 仅 workflow.md（全局工作流） | ❌ **缺失** |
| **3** | `04-tech-design/` | phase1-design-tech.md 等 | ✅ |
| **4** | `06-test-design/` | 空 | ❌ |
| **5** | `packages/` | 骨架代码 | ⚠️ |
| **6** | 测试代码 | 无 | ❌ |
| **7** | `07-deploy-design/` | 空 | ❌ |

### 根因分析
AI 仅凭 memory 中"Phase 1 Design Spec 审核通过"就推断"设计类文档齐了"。把"有技术文档(Step 3)"等同于"产品设计文档齐全"——未经验证的跳跃推断。**没有去实际检查 `docs/03-prd/` 目录。**

### 整改措施
1. 写入 feedback memory：`memory/feedback_verify_step_completion.md`
2. 更新 CLAUDE.md：新增「步骤完成状态核查规则」段落
3. 更新 MEMORY.md 索引

---

## 三、PRD 编写规范设计（核心产出）

### 决策过程（Brainstorming 流程）

#### 澄清问题 & 结论

| # | 问题 | 结论 |
|---|------|------|
| 1 | PRD 受众？ | 双目标：人可读 + AI 可消费 |
| 2 | 内容边界？ | 产品层 + AI 编码提示（不重复技术方案） |
| 3 | 页面交互表达方式？ | Mermaid 图 + 文字表格 |
| 4 | 章节结构？ | 全选 7 章（概述/范围/页面交互/业务规则/数据规格/AI提示/验收标准）+ 用户补充领域模型引用 |
| 5 | 详细粒度？ | 实现级——AI 可直接依据写代码 |
| 6 | 结构方案？ | 方案 C：分层嵌套型（以功能点为原子单元自包含）+ 严格规定模板 |

#### 用户关键补充要求
1. **业务流程章节很重要**，应放在功能范围之前（成为 §2）
2. **业务流程图格式需要详细讨论明确**
3. **流程图必须有泳道**（swimlane），泳道可以是用户或系统/页面
4. **规范文件应写入 `docs/03-prd/` 目录而非 `docs/04-tech-design/`
5. **状态机子节增加一致性校验规则**：状态机状态清单必须与 domain-model 枚举值完全一致

#### 业务流程图格式决策

**统一使用 Mermaid flowchart TD + subgraph 泳道**

节点形状约定：

| 含义 | Mermaid 语法 | 示例 |
|------|-------------|------|
| 用户操作 | `[文本]` 矩形 | `[点击新建按钮]` |
| 系统/页面行为 | `([文本])` 圆角矩形 | `(显示创建表单)` |
| 判断/条件 | `{文本}` 菱形 | `{校验通过？}` |
| 数据/状态 | `[[文本]]` Stadium 形 | `[[status=draft]]` |
| API 调用 | `>文本]` 非对称形 | `>POST /api/projects]` |
| 开始/结束 | `([*])` | — |

三级流程粒度：

| 类型 | 粒度 | 位置 | 必填 |
|------|------|------|:----:|
| 主业务流程 Happy Path | 模块级 | §2.1 | ✅ |
| 完整流程含异常分支 | 功能点级 | §2.2 或 §4.X.3 | ⚠️ |
| 页面交互流程 | 单页面级 | §4.X.3 或 §2.3 | ⚠️ |

### 最终 PRD 规范模板（6 章）

```
# [模块名] PRD > 元信息头
## 1. 概述（定位目标 / 用户角色 / 前置依赖）
## 2. 业务流程 ★ 骨架（Mermaid flowchart + 泳道）
│  2.1 主流程 Happy Path
│  2.2 完整流程（含异常）
│  2.3 页面交互流程
## 3. 功能范围总览
│  3.1 功能清单 F-Mx-NN 编号 P0/P1/P2
│  3.2 Out of Scope
│  3.3 术语表（按需）
## 4. 功能点详细设计 ★ 血肉（核心）
│  4.X [功能点名] 自包含编码单元
│  │  4.X.1 涉及领域模型（实体表 + ER 图）
│  │  4.X.2 页面设计（Mermaid 布局 + 元素清单表）
│  │  4.X.3 交互行为（操作流程表 + 状态机⚠️一致性校验 + 快捷操作）
│  │  4.X.4 业务规则（校验/约束/异常）
│  │  4.X.5 数据规格（输入输出字段 + 枚举定义）
│  │  4.X.6 AI 编码提示（仅陷阱）
## 5. 跨功能规则
│  5.1 全局状态流转约束
│  5.2 全局校验规则 G- 编号
│  5.3 全局交互约定
│  5.4 权限与访问控制
## 6. 验收标准 AC-Mx-NN 编号
   6.1 功能验收 / 6.2 异常验收 / 6.3 UI/UX 验收
```

编号体系：`F-` 功能点 / `B-` 业务规则 / `G-` 全局规则 / `AC-` 验收标准

### 产出物

| 文件 | 路径 | Commit |
|------|------|--------|
| PRD 编写规范 v1.0 | `docs/03-prd/prd-convention.md` (543 行) | `3818883` |
| CLAUDE.md 更新 | 新增 prd-convention.md 引用 + 步骤核查规则 | 同上 |
| Feedback memory | `memory/feedback_verify_step_completion.md` | — |
| MEMORY.md 索引更新 | 新增 feedback 条目 | — |

---

## 四、M1 项目管理模块 PRD 编写（进行中）

### 编写方法
使用 write-prd Skill 的「逐节确认」流程 + 「逐功能点审核」模式。

### 已完成并审核通过

| 章节 | 内容 | 文件 | 状态 |
|------|------|------|:----:|
| §1 | 概述（定位/角色/前置依赖/参考输入） | prd.md | ✅ 通过 |
| §2 | 业务流程（Happy Path / 完整流程 / 页面交互, 8 张 Mermaid 图） | prd.md | ✅ 通过 |
| §3 | 功能范围总览（10 功能点 / 8 项 Out of Scope / 5 术语） | prd.md | ✅ 通过 |
| §4.1 | F-M1-01 项目列表（样例, CRUD 全维度规则） | prd.md | ✅ 通过 |
| §4.2 | F-M1-02 创建项目 | prd.md | ✅ 通过 |
| §4.3 | F-M1-03 查看项目详情 | prd.md | ✅ 通过 |
| §4.4 | F-M1-04 编辑项目基本信息 | prd.md | ✅ 通过 |

### 已写入待审核

| 章节 | 内容 | 文件 | 状态 |
|------|------|------|:----:|
| §4.5~§4.10 | F-M1-05 ~ F-M1-10（归档/公司/部门/角色/外部实体/统计） | prd-2.md | ⏳ 待审核 |
| §5 | 跨功能规则（状态机/校验/交互/权限） | prd-2.md | ⏳ 待审核 |
| §6 | 验收标准（功能24 + 异常6 + UI/UX 8） | prd-2.md | ⏳ 待审核 |

### 关键决策记录

| # | 决策 | 结论 |
|---|------|------|
| 1 | PRD 文件分拆 | 单文件过大, 按 user 要求拆为 prd.md + prd-2.md |
| 2 | 归档级联行为 | 只改 `projects.status='archived'`, 子数据完全不动, 查询时 JOIN 过滤 |
| 3 | name 可编辑性 | 仅 ID 不可变, name 创建后可编辑（带唯一性校验） |
| 4 | 组织架构定位 | 公司/部门/角色是**建模对象内的业务参与方**, 不是系统组织架构 |
| 5 | 外部实体 vs 公司 | 外部实体直接隶属 Project; 公司通过 Company 表间接隶属 |
| 6 | 恢复操作 | 归档可恢复（active ↔ archived 双向转换）, 在 F-M1-05 中一并设计 |

### 踩过的坑

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | Mermaid 中文括号 `（）` 导致 Parse error | 替换为半角 `()` |
| 2 | Mermaid 中文逗号 `，` 导致 Parse error | **根本规则: 所有含特殊字符的节点文本用双引号包裹 `"..."`** |
| 3 | Mermaid `|text|` Stadium 格式中 `|` 是语法分隔符 | 改用 `[text]` 矩形格式 |
| 4 | F-M1-04 插入位置错误（跑到 4.3.3 后面）| 删除错位块, 重新插入到 4.3.6 之后 |
| 5 | 前置依赖误分类（DB Schema/Tech Design 不应是 Step 2 前置）| 拆分为 §1.3 真实前置 + §1.4 参考输入 |
| 6 | 业务规则格式过于简化（扁平表）| 改为 CRUD 操作维度拆分（Query/Create/Update/Delete + 校验汇总 + 异常汇总） |
| 7 | 设计疑问未向用户确认就直接写进 PRD | **教训: 有疑问必须用 AskUserQuestion 询问, 不能自作主张** |

### 文件路径
- prd.md: `docs/03-prd/modules/project-management/project-management-prd.md`（962 行, §1~§4.4）
- prd-2.md: `docs/03-prd/modules/project-management/project-management-prd-2.md`（1258 行, §4.5~§6）

---

## 五、F-M1-04 修复 + prd-2.md 完成（续）

### F-M1-04 文档结构修复

**问题**: 上次会话中 F-M1-04 被错误插入到 §4.3.2 和 §4.3.3 之间, 导致 4.3.3~4.3.6 出现在整个 4.4 块之后。

**修复**: 删除错位块 → 在 §4.3.6 之后重新插入完整 F-M1-04 内容（131 行, 含 6 子节）→ 用户确认通过。

### prd-2.md 创建

用户要求: "都放在一个文件太大了, 新开 project-management-prd-2.md 继续写"

写入内容:
- **§4.5** F-M1-05 归档/恢复项目（~120 行）— 标记操作 / AlertDialog / 级联行为
- **§4.6** F-M1-06 公司管理（~200 行）— CRUD / 三级导航第一级 / 级联删除
- **§4.7** F-M1-07 部门管理（~170 行）— CRUD / 第二级 / company_id 范围唯一性
- **§4.8** F-M1-08 角色管理（~180 行）— CRUD / 第三级叶子节点 / dept_id 范围唯一性
- **§4.9** F-M1-09 外部实体管理 P1（~130 行）— CRUD / type 枚举 / 直接隶属项目
- **§4.10** F-M1-10 项目摘要统计 P1（~80 行）— 列表内嵌 / 详情 API / 缓存策略
- **§5** 跨功能规则（~120 行）— 状态机 / 全局校验 G-M1-04~10 / 交互约定 UI-M1-01~07 / 权限矩阵
- **§6** 验收标准（~100 行）— 功能 AC-M1-01~24 / 异常 E01~06 / UI-UX U01~08

**结果**: prd-2.md 共 1258 行。用户决定"记录待办, 明天继续审核"。

---

## 六、Roadmap V3 重写

### 背景

用户要求检查 roadmap 是否与实际规划有出入。

### 核查发现（V2 vs 实际状态）

| 维度 | V2 记录 | 实际状态 |
|------|---------|---------|
| Phase 1 完成率 | **0%**（8 任务全部"待开始"）| **~25-30%** |
| PRD 工作 | **完全未跟踪** | prd-convention v1.0 + M1 PRD 2220 行 |
| 技术方案 | 隐含在 1.2 中 | **已提前完成**（636+568 行, 双双审核） |
| 基础设施 | 全部"待开始" | **Monorepo 5 包就绪, Layout 193行, E2E 3 用例** |
| 任务模型 | 8 个线性任务 1.1→1.8 | **按模块 × SDLC 7 步**实际执行 |

### 结构性问题

V2 的线性任务模型与实际执行的「模块化 × SDLC」模式不匹配:
- V2 把组件库/HTML引擎/预览界面归入 Phase 1 → 实际应属 Phase 2
- V2 缺少 M4 业务架构和菜单管理模块（tech design 有 6 组路由, V2 只隐含 3）

### V3 重写决策

用户选择: **重写为 V3（推荐）**

核心变更:
1. Phase 1 = 1-A 基础设施(9项✅) + M1~M4(×SDLC 7步) + 菜单管理
2. Phase 2 吸收原 Phase 1 的非数据管理能力（应用页面/组件库/HTML/校验/预览 = 新增 2.7~2.11）
3. PRD Step 2 作为一等公民独立追踪
4. 进度从 0% 修正为 ~52%（后补入 M4+菜单后 ~49%）

### 遗漏模块发现与补全

对照 `phase1-design-tech.md` 的 6 组路由核查, 发现 V3 v1 遗漏:

| 遗漏模块 | API 端点数 | 处理方式 |
|---------|:----------:|---------|
| **M4 业务架构**（architecture.ts） | 11 | 衜入 Phase 1 为 1-E |
| **系统菜单管理**（menu.ts） | ~6 | 补入 Phase 1 为 1-F（轻量级, 可并入 M1 实施） |

最终 Phase 1 = **6 个模块**, 与 tech design 6 组路由完全对齐（84 个 API 端点）。

---

## 七、Roadmap 文件夹化重构

### 用户需求

"把 roadmap 分为主 map 和详细每个阶段的明细 map 2 层结构, 路径转移到文件夹: docs/00-project/roadmap/"

### 执行

**旧**: `docs/00-project/roadmap.md`（单文件 389 行）

**新**: `docs/00-project/roadmap/` （7 个文件, 451 行）

| 文件 | 行数 | 内容 |
|------|:----:|------|
| README.md | 106 | 主路线图: SDLC 模型 + 整体视图 ASCII + 进度总览 + 版本历史 + 文件索引 |
| phase0.md | 46 | Phase 0 设计规格冻结（15 任务 + 10 项文档产出） |
| phase1.md | 204 | Phase 1 数据模型中心（基础设施 + M1~M4 + 菜单 + PRD 进度 + API 端点） |
| phase2.md | 32 | Phase 2 核心引擎 + 交互原型（11 任务） |
| phase3.md | 26 | Phase 3 成熟度提升（12 任务） |
| phase4.md | 18 | Phase 4 下游 Coding AI（方向性任务） |
| phase5.md | 19 | Phase 5 AI 能力增强（方向性任务） |

### 同步更新

| 文件 | 变更 |
|------|------|
| CLAUDE.md | 目录树 `roadmap.md` → `roadmap/` 文件夹; 规范表路径; 当前阶段描述 |
| README.md | 目录结构同步; 技术栈补充; 当前状态描述 |
| docs/00-project/roadmap.md | 已删除（拆分到文件夹） |

---

## 八、Commit & Push

### Commit: `b59d90c`

```
docs: restructure roadmap to V3 folder + M1 PRD + write-prd skill

20 files changed, 3995 insertions(+), 223 deletions(-)
```

关键文件:
- Roadmap V3: `docs/00-project/roadmap/` (7 files, 451 lines)
- M1 PRD: `project-management-prd.md` (962) + `prd-2.md` (1258)
- write-prd skill: `.claude/skills/write-prd/` (SKILL.md + template + checklist)
- Skills restructure: coding-with-comments/ + review-code-comments/ → folder format
- CLAUDE.md + README.md: directory tree and status updates
- Conversation log: `logs-important/2026-05-02-conversation.md`

Push: `feature/phase1` → `origin/feature/phase1` ✅

---

## 九、待办

1. **[Task #1]** 审核 project-management-prd-2.md（F-M1-05 ~ F-M1-10 + §5 + §6）
2. M1 PRD 审核通过后 → Step 4 测试设计 → Step 5 编码实现
3. M2/M3/M4 PRD 编写（按依赖顺序: M1 → M2 → M3 → M4）
