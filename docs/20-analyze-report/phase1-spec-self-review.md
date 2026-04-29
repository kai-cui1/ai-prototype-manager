# Phase 1 Design Spec 自检报告

> **日期**：2026-04-29
> **审查对象**：`docs/superpowers/specs/2026-04-28-phase1-design.md`
> **审查方法**：从 MVP 可用系统角度，逐场景走查 Done Demo（11.1 节）定义的完整使用流程
> **审查状态**：✅ 已逐项确认并修复（2026-04-29）

---

## 一、审查方法

以 **11.1 Done Demo 场景** 为测试用例，逐步骤验证 Spec 是否提供了完整的数据模型、API、校验规则来支撑该场景。

**Done Demo 完整流程**：

```
1. 打开浏览器 → Sidebar 渲染（menus 表）
2. 菜单管理页面 → CRUD 菜单项
3. 项目列表页 → 查看项目
4. 进入项目详情 → Tab 0 组织架构 → 公司/部门/角色/外部实体 CRUD
5. Tab 1 领域模型 → 实体/字段/关系 CRUD + ER 图展示
6. Tab 2 业务流程 → 架构树管理 + 流程 CRUD + 节点画布编辑
```

---

## 二、发现的问题清单

### P0 — 严重阻塞（必须修复）

#### 问题 1：applications 表缺少 `type` 字段 —— 数据完整性断裂

**位置**：表 10（applications 定义）

**现状**：
```sql
CREATE TABLE applications (
  id, project_id, name, display_name, description,
  icon, sort_order, config, timestamps
  -- ❌ 缺少 type 字段！
);
```

**影响链路**：
```
process_nodes.holder_type = 'service'
  → holder_id 引用 applications(type='service').id
    → 但 applications 表没有 type 字段！无法区分 service 类型
      → 创建节点选 holder=service 时数据不完整
        → 泳道渲染时无法筛选出 service 类型的应用
```

**根因**：之前差距分析已识别为 P0 待办（applications.type 字段），但一直未补入 Spec。

**建议**：新增 `type TEXT NOT NULL DEFAULT 'web'` 字段，枚举值 `web | android | ios | pc | api | service`。

---

#### 问题 2：L2 校验描述过时 —— 还写着"8 种 node_type"

**位置**：6.2 节 Phase 1 实现范围表

**原文**：
> node_type 校验（**8 种**）

**实际**：node_type 已精简为 `action` | `decision` 仅 2 种。

**影响**：实施时可能按错误规格实现校验逻辑。

**建议**：改为 "node_type 校验（2 种：action / decision）"。

---

### P1 — 中等问题（实施前应补）

#### 问题 3：循环检测 —— Done Demo 写了但 Spec 零定义

**位置**：11.1 Done Demo 明确写了：
> 循环检测警告（画回边时提示）

**Spec 缺失内容**：
| 维度 | 状态 |
|------|:----:|
| API 端点 | ❌ 无循环检测端点 |
| 算法位置 | ❌ 未确定是服务端还是客户端检测 |
| 算法描述 | ❌ DFS？拓扑排序？ |
| 错误码 | ❌ 未定义（用 VALIDATION_FAILED？新码？） |
| 前端交互 | ❌ 警告样式？阻断？仅提示？ |

**建议**：至少补充算法位置和基本策略。

---

#### 问题 4：前端页面列表缺 MenuManagementPage

**位置**：3 节 Monorepo 项目结构 · web/src/pages/

**当前列表**：
```
✅ ProjectList.tsx
✅ ProjectDetail.tsx
✅ DomainModelEditor.tsx
✅ ProcessEditor.tsx
✅ OrganizationPanel.tsx
✅ ArchitectureView.tsx
❌ MenuManagement.tsx   -- 缺失
```

**建议**：补充到页面列表。

---

#### 问题 5：validation-schemas 文件清单不同步

**位置**：3 节 vs 6.5 节

| 位置 | 列出的文件数 | 差异 |
|------|:-----------:|:----:|
| **3 节** Monorepo 结构 | **4 个**（project/domain/process + index） | ❌ 缺 3 个 |
| **6.5 节** Schema 结构 | **7 个**（+ organization/architecture/menu） | ✅ 正确 |

**缺失文件**（3 节未列出）：
- `organization.schema.ts`
- `architecture.schema.ts`
- `menu.schema.ts`

**建议**：同步 3 节的文件清单。

---

#### 问题 6：process_node_map 的 entryNode 注释与 business_processes.entry_node_id 冲突

**两处定义**：

| 字段 | 位置 | 含义 |
|------|------|------|
| `business_processes.entry_node_id` | 表 6 | 流程的入口节点 ID |
| `process_node_map.sort_order=0` | 表 9 注释 | "表示该节点的 entryNode（入口节点）" |

**冲突场景**：
- 如果 `entry_node_id` 指向节点 A，但 A 在 `process_node_map` 中 `sort_order=5`
- 哪个是权威入口定义？

**可能的解释方向**：
- A) `entry_node_id` 是唯一权威入口，`sort_order=0` 的注释应删除或修改
- B) `sort_order=0` 是历史遗留，实际不再用于标识入口
- C) 两者含义不同需要区分命名

**建议**：统一语义，删除歧义注释。

---

### P2 — 轻微问题（可实施时再定）

#### 问题 7：工作台/Dashboard 页面有菜单无实现

**现象**：菜单 Seed 数据包含「工作台」(`/`)，Done Demo Sidebar 也显示了。
**缺失**：无对应前端组件、无后端聚合 API。

**建议**：Phase 1 工作台可简化为"最近访问的项目列表"或直接重定向到项目列表。

---

#### 问题 8：项目列表搜索参数未定义

**API 描述**："分页+搜索+筛选"
**缺失**：具体支持哪些搜索字段？name 模糊匹配？status 筛选？时间范围？

**建议**：Phase 1 最小化：支持 name 搜索 + status 筛选即可。

---

#### 问题 9：删除角色/外部实体时的级联行为细节未定义

**API 描述**："清理节点 holder 引用"
**未明确**：
- 阻止删除（返回 422 UNPROCESSABLE_ENTITY）？
- 级联置空 holder_id？
- 级联删除引用了该角色的节点？

**建议**：采用"阻止删除 + 返回 422 + 列出引用详情"的策略。

---

#### 问题 10：ER 图 → ReactFlow 映射规格缺失

**选定技术**：ReactFlow 做 ER 图视图 + 流程画布
**缺失规格**：
| 映射项 | 未定义 |
|--------|:------:|
| 实体 → ReactFlow 节点类型 | custom node? 默认节点? |
| 关系 → edge 类型 | straight? step? bezier? |
| targetCardinality 渲染 | edge label? tooltip? |
| 布局方向 | 水平 DAG？垂直树？力导向？ |
| 节点颜色/形状区分 | entity_type 不同色？ |

**建议**：在实施计划中补充 UI 交互规格。

---

#### 问题 11：field_type Phase 1 UI 取值子集未枚举

**数据库**：26 种全部支持
**Seed 数据**："覆盖常用字段类型子集"
**缺失**：前端下拉框 Phase 1 具体展示哪些？

**建议**：Phase 1 先支持核心子集（~10 种）：string / number / boolean / datetime / text / enum / email / url / status / reference。其余后续加。

---

## 三、问题统计总览

| 优先级 | 数量 | 编号 |
|:------:|:----:|------|
| **P0** | 2 | #1, #2 |
| **P1** | 4 | #3, #4, #5, #6 |
| **P2** | 5 | #7, #8, #9, #10, #11 |
| **总计** | **11** | |

## 四、非问题项（已确认正确的部分）

以下核心设计经走查确认无误：

- ✅ 19 张表的字段定义完整且一致
- ✅ ~91 个 API 端点覆盖所有 CRUD
- ✅ ER 关系图与表结构对齐
- ✅ entity_relations 单向关系模型设计思路完整
- ✅ process_nodes holder 外键模式正确
- ✅ node_type 精简为 action/decision 合理
- ✅ 组织架构 3 层模型完整
- ✅ 业务架构 + 映射表分离正确
- ✅ 菜单轻量版设计合理
- ✅ 校验机制 L1/L2 分层清晰
- ✅ 错误处理体系完整
- ✅ 开发环境 Docker 配置可用
- ✅ Seed 数据覆盖范围充分

---

## 五、问题修复记录

### P0 修复（2 项）

| # | 问题 | 修复方案 | 状态 |
|---|------|---------|:----:|
| 1 | applications 缺 type 字段 | 新增 `type TEXT NOT NULL DEFAULT 'web'`，枚举值 web/wxapp/android/ios/pc/api/service（7 种） | ✅ |
| 2 | L2 校验写"8 种 node_type"过时 | 改为 "node_type 校验（2 种：action / decision）" | ✅ |

### P1 修复（4 项）

| # | 问题 | 修复方案 | 状态 |
|---|------|---------|:----:|
| 3 | 循环检测零定义 | 两端都做 + 阻断策略：后端创建边时 DFS 检测返回 422；前端画布即时检测阻断连线。算法：从 target DFS 回到 source 则成环。错误码复用 UNPROCESSABLE_ENTITY | ✅ |
| 4 | 缺 MenuManagementPage | 补充到 pages 列表 | ✅ |
| 5 | Schema 文件清单不同步 | 3 节 Monorepo 结构补全 7 个 schema 文件（+ base/organization/architecture/menu） | ✅ |
| 6 | entryNode 双重定义冲突 | 明确 `entry_node_id` 为唯一权威入口；`process_node_map.sort_order=0` 仅用于排序，注释已修正 | ✅ |

### P2 处理（5 项）

| # | 问题 | 处理方案 | 状态 |
|---|------|---------|:----:|
| 7 | 工作台无实现 | Phase 1 去掉工作台菜单项，Seed 数据和 Done Demo 已同步 | ✅ |
| 8 | 项目列表搜索参数未定义 | API 端点补充说明：name 模糊搜索 + status 筛选 | ✅ |
| 9 | 删除角色级联行为未定义 | 采用阻止删除策略：返回 422 + 列出引用节点详情 | ✅ |
| 10 | ER 图 ReactFlow 映射规格缺失 | 延后到「系统模块详细设计方案」阶段再定 | ⏸️ 延后 |
| 11 | field_type UI 子集未枚举 | 同上，实施时确定 Phase 1 下拉框取值 | ⏸️ 延后 |
