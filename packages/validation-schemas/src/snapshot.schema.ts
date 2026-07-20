/**
 * @module snapshot.schema
 * @description TypeBox validation schemas for Project Snapshot API.
 *              Provides getProjectSnapshot endpoint — the "entry ritual" for Design AI
 *              to acquire project-wide context before making any changes.
 *
 * Design Decisions (D-14 / D-15):
 * - Level 0 returns reference-level key attributes (id/name/displayName/paramCounts),
 *   NOT just numeric counts (e.g. actionCount: 4 is useless for AI).
 * - AI needs three layers of info to operate correctly:
 *   L1 concept meta (System Prompt) + L2 operation rules (System Prompt) +
 *   L3 reference-level attributes (snapshot data enhancement).
 */
import { Type } from '@sinclair/typebox';
import {
  IdSchema,
  NameSchema,
  DisplayNameSchema,
} from './base.js';
import { SuccessEnvelope } from './response.js';

// ============================================================
// Request Schemas
// ============================================================

/**
 * Query parameters for GET /api/v1/projects/:projectId/snapshot
 *
 * - level: 0 = overview with reference-level attributes (default)
 *          1 = detailed data for specified modules
 * - modules: which modules to include at level 1 (comma-separated)
 */
export const SnapshotQuery = Type.Object({
  level: Type.Optional(Type.Union([
    Type.Literal(0),
    Type.Literal(1),
  ], { default: 0, description: '快照层次：0=概要+引用属性, 1=模块详情' })),
  modules: Type.Optional(Type.String({
    maxLength: 200,
    description: 'Level 1 时指定返回的模块，逗号分隔：domain,organization,process,application,architecture',
  })),
});

/** Path parameter schema */
export const SnapshotProjectIdParam = Type.Object({
  projectId: IdSchema,
});

// ============================================================
// Level 0 Sub-Schemas (Reference-Level Attributes)
// ============================================================

/** Action 引用级属性 — D-14 决策：包含 id/name/displayName + 参数数量 */
const ActionRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  inputCount: Type.Number({ minimum: 0, description: '输入参数数量' }),
  outputCount: Type.Number({ minimum: 0, description: '输出参数数量' }),
});

/** Decision 引用级属性 — 包含 id/name/displayName + 分支数量 */
const DecisionRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  branchCount: Type.Number({ minimum: 0, description: '分支数量' }),
});

/** Entity 引用级属性 */
const EntityRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  category: Type.Optional(Type.String({ description: '实体分类' })),
  fieldCount: Type.Number({ minimum: 0, description: '字段数量' }),
});

/** Entity relation 引用级属性 */
const RelationRefItem = Type.Object({
  id: IdSchema,
  sourceEntityName: Type.String({ description: '源实体名称' }),
  targetEntityName: Type.String({ description: '目标实体名称' }),
  relationKind: Type.String({ description: '关系类型' }),
});

/** Domain boundary 引用级属性 */
const BoundaryRefItem = Type.Object({
  id: IdSchema,
  name: Type.String({ description: '领域名称' }),
});

/** Company 引用级属性 */
const CompanyRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
});

/** Department 引用级属性 */
const DepartmentRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  companyId: IdSchema,
});

/** Role 引用级属性 — 包含 actions/decisions 引用级信息 */
const RoleRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  category: Type.Optional(Type.String({ description: '角色分类' })),
  actions: Type.Array(ActionRefItem),
  decisions: Type.Array(DecisionRefItem),
});

/** External entity 引用级属性 */
const ExternalEntityRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  entityType: Type.Optional(Type.String({ description: '外部实体类型' })),
  actions: Type.Array(ActionRefItem),
  decisions: Type.Array(DecisionRefItem),
});

/** Process 引用级属性 */
const ProcessRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  status: Type.String({ description: '流程状态' }),
  nodeCount: Type.Number({ minimum: 0, description: '节点数量' }),
  edgeCount: Type.Number({ minimum: 0, description: '边数量' }),
});

/** Page 引用级属性 */
const PageRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
});

/** Application 引用级属性 — 包含 actions/decisions/pages 引用级信息 */
const ApplicationRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  type: Type.String({ description: '应用类型' }),
  actions: Type.Array(ActionRefItem),
  decisions: Type.Array(DecisionRefItem),
  pages: Type.Array(PageRefItem),
});

/** Architecture node 引用级属性 */
const ArchNodeRefItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  level: Type.Optional(Type.String({ description: '层级标注' })),
  parentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
});

/** Architecture-process mapping */
const ArchProcessMapRefItem = Type.Object({
  architectureId: IdSchema,
  processId: IdSchema,
});

// ============================================================
// Level 0 Snapshot Response Structure
// ============================================================

/** Level 0 快照响应 — 概要 + 引用级属性 */
export const SnapshotLevel0Response = SuccessEnvelope(Type.Object({
  project: Type.Object({
    id: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.String(),
    version: Type.Number(),
  }),
  domain: Type.Object({
    entities: Type.Array(EntityRefItem),
    relations: Type.Array(RelationRefItem),
    boundaries: Type.Array(BoundaryRefItem),
  }),
  organization: Type.Object({
    companies: Type.Array(CompanyRefItem),
    departments: Type.Array(DepartmentRefItem),
    roles: Type.Array(RoleRefItem),
    externalEntities: Type.Array(ExternalEntityRefItem),
  }),
  process: Type.Object({
    processes: Type.Array(ProcessRefItem),
  }),
  application: Type.Object({
    applications: Type.Array(ApplicationRefItem),
  }),
  architecture: Type.Object({
    nodes: Type.Array(ArchNodeRefItem),
    processMappings: Type.Array(ArchProcessMapRefItem),
  }),
}));

// ============================================================
// Level 1 Snapshot Response Structure
// ============================================================

/**
 * Level 1 快照响应 — 在 Level 0 基础上，指定模块返回完整详情数据。
 * modules 未指定时等同于 Level 0。
 *
 * detail 字段为 optional — 仅在 modules 参数包含对应模块时返回。
 */
export const SnapshotLevel1Response = SuccessEnvelope(Type.Object({
  project: Type.Object({
    id: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.String(),
    version: Type.Number(),
  }),
  domain: Type.Object({
    entities: Type.Array(EntityRefItem),
    relations: Type.Array(RelationRefItem),
    boundaries: Type.Array(BoundaryRefItem),
    /** Level 1 详情：每个实体的完整字段列表 */
    entityDetails: Type.Optional(Type.Array(Type.Object({
      id: IdSchema,
      name: NameSchema,
      displayName: DisplayNameSchema,
      description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      fields: Type.Array(Type.Object({
        id: IdSchema,
        name: NameSchema,
        displayName: DisplayNameSchema,
        fieldType: Type.String(),
        isRequired: Type.Boolean(),
      })),
    }))),
  }),
  organization: Type.Object({
    companies: Type.Array(CompanyRefItem),
    departments: Type.Array(DepartmentRefItem),
    roles: Type.Array(RoleRefItem),
    externalEntities: Type.Array(ExternalEntityRefItem),
    /** Level 1 详情：角色的完整 action/decision 定义 */
    roleDetails: Type.Optional(Type.Array(Type.Object({
      id: IdSchema,
      name: NameSchema,
      displayName: DisplayNameSchema,
      actions: Type.Array(Type.Unknown()),
      decisions: Type.Array(Type.Unknown()),
    }))),
    /** Level 1 详情：外部实体的完整 action/decision 定义 */
    externalEntityDetails: Type.Optional(Type.Array(Type.Object({
      id: IdSchema,
      name: NameSchema,
      displayName: DisplayNameSchema,
      actions: Type.Array(Type.Unknown()),
      decisions: Type.Array(Type.Unknown()),
    }))),
  }),
  process: Type.Object({
    processes: Type.Array(ProcessRefItem),
    /** Level 1 详情：每个流程的完整节点和边 */
    processDetails: Type.Optional(Type.Array(Type.Object({
      id: IdSchema,
      name: NameSchema,
      displayName: DisplayNameSchema,
      nodes: Type.Array(Type.Unknown()),
      edges: Type.Array(Type.Unknown()),
    }))),
  }),
  application: Type.Object({
    applications: Type.Array(ApplicationRefItem),
    /** Level 1 详情：应用的完整 action/decision/page 定义 */
    applicationDetails: Type.Optional(Type.Array(Type.Object({
      id: IdSchema,
      name: NameSchema,
      displayName: DisplayNameSchema,
      actions: Type.Array(Type.Unknown()),
      decisions: Type.Array(Type.Unknown()),
      pages: Type.Array(Type.Unknown()),
    }))),
  }),
  architecture: Type.Object({
    nodes: Type.Array(ArchNodeRefItem),
    processMappings: Type.Array(ArchProcessMapRefItem),
    /** Level 1 详情：架构树的完整结构 */
    architectureDetails: Type.Optional(Type.Array(Type.Unknown())),
  }),
}));
