# Phase 1+ 扩展预留（功能想法）

> **来源**：拆分自 `99-archived/2026-04-28-phase1-design.md`（原件归档保留）
> **对应原文件章节**：§13 Phase 1+ 扩展预留
> **关联文档**：
> - 数据库表定义 → `../05-data-design/phase1-database-schema.md`
> - 技术方案设计 → `../04-tech-design/phase1-design-tech.md`
> **日期**：2026-04-28
> **状态**：记录中，待后续 Phase 规划时参考

---

## 13. Phase 1+ 扩展预留

> 以下功能已在 Phase 1 设计过程中被识别，但因 MVP 范围控制不纳入 Phase 1 实现。记录在此供后续 Phase 规划时参考。

### 13.1 Holder 组织架构扩展（部门维度）

**背景**：`process_nodes.holder_type` 当前仅支持 `role` | `service` 两种值，用于泳道渲染和行为执行者标识。

**问题**：实际流程规划时常从**部门/组织架构**视角审视行为执行者——例如"运维部负责故障处理"比"运维工程师角色负责"更符合组织管理视角。Role 是部门下的子概念。

**扩展方向**：
- 新增 `department` 作为 `holder_type` 的第三种取值
- 建立 **Role ↔ Department** 的归属关系（一个 Department 包含多个 Role）
- 泳道渲染支持按部门分组显示
- 数据模型层面可考虑新增 `departments` 表或用 JSONB 配置表达

**影响范围**：process_nodes 表（holder_type 枚举扩展）、泳道渲染逻辑、可能的 departments 表

**建议归属 Phase**：Phase 3（团队协作/权限相关）或 Phase 1.5（MVP 迭代优化）
