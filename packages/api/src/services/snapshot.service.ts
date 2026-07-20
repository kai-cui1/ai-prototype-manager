/**
 * @module snapshot.service
 * @description 项目快照 Service 层：聚合多表数据，为 Design AI 提供项目全局上下文。
 *              纯函数风格（db 作为首参数），无全局状态依赖。
 *
 * Design Decisions (D-14 / D-15):
 * - Level 0 返回引用级关键属性（id/name/displayName/参数数量），不返回纯数字计数
 * - AI 可以在快照中直接找到可引用的 action ID，无需反复调 detail API
 * - Level 1 按模块返回完整详情数据
 */
import type { Db } from '../db.js';
import { eq, count, sql } from 'drizzle-orm';
import {
  projects,
  domainEntities,
  entityFields,
  entityRelations,
  domainBoundaries,
  companies,
  departments,
  roles,
  externalEntities,
  businessProcesses,
  processNodes,
  processEdges,
  applications,
  pages,
  businessArchitectures,
  bizArchProcessMap,
} from '../models/schema.js';
import { notFound } from './common/errors.js';

// ============================================================
// Types
// ============================================================

interface SnapshotParams {
  level: 0 | 1;
  modules?: string[];
}

/** JSONB action item from DB (roles.actions, externalEntities.actions, applications.actions) */
interface JsonbActionItem {
  id?: string;
  name?: string;
  displayName?: string;
  inputs?: unknown[];
  outputs?: unknown[];
  [key: string]: unknown;
}

/** JSONB decision item from DB */
interface JsonbDecisionItem {
  id?: string;
  name?: string;
  displayName?: string;
  branches?: unknown[];
  [key: string]: unknown;
}

// ============================================================
// Helper: Extract reference-level attributes from JSONB actions/decisions
// ============================================================

/**
 * 从 JSONB actions 数组中提取引用级属性。
 * D-14 决策：AI 需要 id/name/displayName/inputCount/outputCount 才能正确引用。
 */
function extractActionRefs(actions: unknown): Array<{
  id: string;
  name: string;
  displayName: string;
  inputCount: number;
  outputCount: number;
}> {
  if (!Array.isArray(actions)) return [];
  return actions.map((a: JsonbActionItem) => ({
    id: a.id ?? '',
    name: a.name ?? '',
    displayName: a.displayName ?? '',
    inputCount: Array.isArray(a.inputs) ? a.inputs.length : 0,
    outputCount: Array.isArray(a.outputs) ? a.outputs.length : 0,
  }));
}

/**
 * 从 JSONB decisions 数组中提取引用级属性。
 * 包含 branchCount，AI 需要知道 Decision 有几个分支才能正确创建边。
 */
function extractDecisionRefs(decisions: unknown): Array<{
  id: string;
  name: string;
  displayName: string;
  branchCount: number;
}> {
  if (!Array.isArray(decisions)) return [];
  return decisions.map((d: JsonbDecisionItem) => ({
    id: d.id ?? '',
    name: d.name ?? '',
    displayName: d.displayName ?? '',
    branchCount: Array.isArray(d.branches) ? d.branches.length : 0,
  }));
}

// ============================================================
// Level 0: Overview with reference-level attributes
// ============================================================

async function getLevel0Snapshot(db: Db, projectId: string) {
  // 1. Verify project exists
  const [project] = await db.select({
    id: projects.id,
    name: projects.name,
    displayName: projects.displayName,
    description: projects.description,
    status: projects.status,
    version: projects.version,
  })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw notFound('Project', projectId);
  }

  // 2. Domain model: entities + field counts + relations + boundaries
  const [entities, fieldCounts, relations, boundaries] = await Promise.all([
    // Entities
    db.select({
      id: domainEntities.id,
      name: domainEntities.name,
      displayName: domainEntities.displayName,
      category: domainEntities.category,
    })
      .from(domainEntities)
      .where(eq(domainEntities.projectId, projectId)),

    // Field counts per entity
    db.select({
      entityId: entityFields.entityId,
      count: count(),
    })
      .from(entityFields)
      .innerJoin(domainEntities, eq(entityFields.entityId, domainEntities.id))
      .where(eq(domainEntities.projectId, projectId))
      .groupBy(entityFields.entityId),

    // Relations
    db.select({
      id: entityRelations.id,
      sourceEntityId: entityRelations.sourceEntityId,
      targetEntityId: entityRelations.targetEntityId,
      relationKind: entityRelations.relationKind,
    })
      .from(entityRelations)
      .where(eq(entityRelations.projectId, projectId)),

    // Boundaries
    db.select({
      id: domainBoundaries.id,
      name: domainBoundaries.name,
    })
      .from(domainBoundaries)
      .where(eq(domainBoundaries.projectId, projectId)),
  ]);

  // Build entity name lookup for relation references
  const entityNameMap = new Map(entities.map(e => [e.id, e.name]));

  // Merge field counts into entities
  const fieldCountMap = new Map(fieldCounts.map(f => [f.entityId, f.count]));
  const entityRefs = entities.map(e => ({
    ...e,
    fieldCount: fieldCountMap.get(e.id) ?? 0,
  }));

  // Relation refs with entity names instead of IDs
  const relationRefs = relations.map(r => ({
    id: r.id,
    sourceEntityName: entityNameMap.get(r.sourceEntityId) ?? '',
    targetEntityName: entityNameMap.get(r.targetEntityId) ?? '',
    relationKind: r.relationKind,
  }));

  // 3. Organization: companies + departments + roles + external entities
  const [companyRows, departmentRows, roleRows, externalEntityRows] = await Promise.all([
    db.select({
      id: companies.id,
      name: companies.name,
      displayName: companies.displayName,
    })
      .from(companies)
      .where(eq(companies.projectId, projectId)),

    db.select({
      id: departments.id,
      name: departments.name,
      displayName: departments.displayName,
      companyId: departments.companyId,
    })
      .from(departments)
      .where(eq(departments.projectId, projectId)),

    db.select({
      id: roles.id,
      name: roles.name,
      displayName: roles.displayName,
      category: roles.category,
      actions: roles.actions,
      decisions: roles.decisions,
    })
      .from(roles)
      .where(eq(roles.projectId, projectId)),

    db.select({
      id: externalEntities.id,
      name: externalEntities.name,
      displayName: externalEntities.displayName,
      entityType: externalEntities.entityType,
      actions: externalEntities.actions,
      decisions: externalEntities.decisions,
    })
      .from(externalEntities)
      .where(eq(externalEntities.projectId, projectId)),
  ]);

  const roleRefs = roleRows.map(r => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    category: r.category,
    actions: extractActionRefs(r.actions),
    decisions: extractDecisionRefs(r.decisions),
  }));

  const externalEntityRefs = externalEntityRows.map(ee => ({
    id: ee.id,
    name: ee.name,
    displayName: ee.displayName,
    entityType: ee.entityType,
    actions: extractActionRefs(ee.actions),
    decisions: extractDecisionRefs(ee.decisions),
  }));

  // 4. Process: processes + node/edge counts
  const processRows = await db.select({
    id: businessProcesses.id,
    name: businessProcesses.name,
    displayName: businessProcesses.displayName,
    status: businessProcesses.status,
  })
    .from(businessProcesses)
    .where(eq(businessProcesses.projectId, projectId));

  // Get node and edge counts per process
  const [nodeCountRows, edgeCountRows] = await Promise.all([
    db.select({
      processId: processNodes.projectId,
      count: count(),
    })
      .from(processNodes)
      .where(eq(processNodes.projectId, projectId))
      .groupBy(processNodes.projectId),

    db.select({
      processId: processEdges.projectId,
      count: count(),
    })
      .from(processEdges)
      .where(eq(processEdges.projectId, projectId))
      .groupBy(processEdges.projectId),
  ]);

  // Since nodes/edges are at project level but belong to specific processes,
  // we need to count per process. The nodeIds/edgeIds in business_processes
  // tell us which nodes/edges belong to which process.
  // For Level 0, use the nodeIds/edgeIds array lengths from process rows.
  const processRowsWithCounts = await db.select({
    id: businessProcesses.id,
    name: businessProcesses.name,
    displayName: businessProcesses.displayName,
    status: businessProcesses.status,
    nodeIds: businessProcesses.nodeIds,
    edgeIds: businessProcesses.edgeIds,
  })
    .from(businessProcesses)
    .where(eq(businessProcesses.projectId, projectId));

  const processRefs = processRowsWithCounts.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    status: p.status,
    nodeCount: Array.isArray(p.nodeIds) ? p.nodeIds.length : 0,
    edgeCount: Array.isArray(p.edgeIds) ? p.edgeIds.length : 0,
  }));

  // 5. Application: applications with actions/decisions/pages
  const [appRows, pageRows] = await Promise.all([
    db.select({
      id: applications.id,
      name: applications.name,
      displayName: applications.displayName,
      type: applications.type,
      actions: applications.actions,
      decisions: applications.decisions,
    })
      .from(applications)
      .where(eq(applications.projectId, projectId)),

    db.select({
      id: pages.id,
      name: pages.name,
      displayName: pages.displayName,
      applicationId: pages.applicationId,
    })
      .from(pages)
      .innerJoin(applications, eq(pages.applicationId, applications.id))
      .where(eq(applications.projectId, projectId)),
  ]);

  // Group pages by application
  const pagesByApp = new Map<string, Array<{ id: string; name: string; displayName: string }>>();
  for (const p of pageRows) {
    if (!pagesByApp.has(p.applicationId)) {
      pagesByApp.set(p.applicationId, []);
    }
    pagesByApp.get(p.applicationId)!.push({ id: p.id, name: p.name, displayName: p.displayName });
  }

  const applicationRefs = appRows.map(a => ({
    id: a.id,
    name: a.name,
    displayName: a.displayName,
    type: a.type,
    actions: extractActionRefs(a.actions),
    decisions: extractDecisionRefs(a.decisions),
    pages: pagesByApp.get(a.id) ?? [],
  }));

  // 6. Architecture: nodes + process mappings
  const [archNodes, archProcessMaps] = await Promise.all([
    db.select({
      id: businessArchitectures.id,
      name: businessArchitectures.name,
      displayName: businessArchitectures.displayName,
      level: businessArchitectures.level,
      parentId: businessArchitectures.parentId,
    })
      .from(businessArchitectures)
      .where(eq(businessArchitectures.projectId, projectId)),

    db.select({
      architectureId: bizArchProcessMap.architectureId,
      processId: bizArchProcessMap.processId,
    })
      .from(bizArchProcessMap)
      .innerJoin(businessArchitectures, eq(bizArchProcessMap.architectureId, businessArchitectures.id))
      .where(eq(businessArchitectures.projectId, projectId)),
  ]);

  return {
    project,
    domain: {
      entities: entityRefs,
      relations: relationRefs,
      boundaries,
    },
    organization: {
      companies: companyRows,
      departments: departmentRows,
      roles: roleRefs,
      externalEntities: externalEntityRefs,
    },
    process: {
      processes: processRefs,
    },
    application: {
      applications: applicationRefs,
    },
    architecture: {
      nodes: archNodes,
      processMappings: archProcessMaps,
    },
  };
}

// ============================================================
// Level 1: Detailed data for specified modules
// ============================================================

async function getLevel1Snapshot(
  db: Db,
  projectId: string,
  modules: string[],
) {
  // Start with Level 0 as base
  const base = await getLevel0Snapshot(db, projectId);

  // Add details only for requested modules
  if (modules.includes('domain')) {
    const entityDetails = await db.select({
      id: domainEntities.id,
      name: domainEntities.name,
      displayName: domainEntities.displayName,
      description: domainEntities.description,
      category: domainEntities.category,
    })
      .from(domainEntities)
      .where(eq(domainEntities.projectId, projectId));

    // Get all fields for these entities
    const fields = await db.select({
      id: entityFields.id,
      name: entityFields.name,
      displayName: entityFields.displayName,
      fieldType: entityFields.fieldType,
      isRequired: entityFields.isRequired,
      entityId: entityFields.entityId,
    })
      .from(entityFields)
      .innerJoin(domainEntities, eq(entityFields.entityId, domainEntities.id))
      .where(eq(domainEntities.projectId, projectId));

    const fieldsByEntity = new Map(fields.map(f => [f.entityId, [] as typeof fields]));
    for (const f of fields) {
      if (!fieldsByEntity.has(f.entityId)) fieldsByEntity.set(f.entityId, []);
      fieldsByEntity.get(f.entityId)!.push(f);
    }

    (base.domain as typeof base.domain & { entityDetails?: unknown }).entityDetails = entityDetails.map(e => ({
      ...e,
      fields: (fieldsByEntity.get(e.id) ?? []).map(f => ({
        id: f.id,
        name: f.name,
        displayName: f.displayName,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
      })),
    }));
  }

  if (modules.includes('organization')) {
    // Get full role details with complete action/decision data
    const roleDetails = await db.select({
      id: roles.id,
      name: roles.name,
      displayName: roles.displayName,
      actions: roles.actions,
      decisions: roles.decisions,
    })
      .from(roles)
      .where(eq(roles.projectId, projectId));

    const externalEntityDetails = await db.select({
      id: externalEntities.id,
      name: externalEntities.name,
      displayName: externalEntities.displayName,
      actions: externalEntities.actions,
      decisions: externalEntities.decisions,
    })
      .from(externalEntities)
      .where(eq(externalEntities.projectId, projectId));

    (base.organization as typeof base.organization & { roleDetails?: unknown }).roleDetails = roleDetails;
    (base.organization as typeof base.organization & { externalEntityDetails?: unknown }).externalEntityDetails = externalEntityDetails;
  }

  if (modules.includes('process')) {
    // Get full process details with nodes and edges
    const processList = await db.select({
      id: businessProcesses.id,
      name: businessProcesses.name,
      displayName: businessProcesses.displayName,
    })
      .from(businessProcesses)
      .where(eq(businessProcesses.projectId, projectId));

    const [allNodes, allEdges] = await Promise.all([
      db.select().from(processNodes).where(eq(processNodes.projectId, projectId)),
      db.select().from(processEdges).where(eq(processEdges.projectId, projectId)),
    ]);

    const nodesByProcess = new Map<string, typeof allNodes>();
    const edgesByProcess = new Map<string, typeof allEdges>();

    // Use process's nodeIds/edgeIds to group
    for (const p of processList) {
      const processRow = await db.select({
        nodeIds: businessProcesses.nodeIds,
        edgeIds: businessProcesses.edgeIds,
      })
        .from(businessProcesses)
        .where(eq(businessProcesses.id, p.id))
        .limit(1);

      const nodeIds: string[] = Array.isArray(processRow[0]?.nodeIds) ? processRow[0].nodeIds : [];
      const edgeIds: string[] = Array.isArray(processRow[0]?.edgeIds) ? processRow[0].edgeIds : [];

      nodesByProcess.set(p.id, allNodes.filter(n => nodeIds.includes(n.id)));
      edgesByProcess.set(p.id, allEdges.filter(e => edgeIds.includes(e.id)));
    }

    (base.process as typeof base.process & { processDetails?: unknown }).processDetails = processList.map(p => ({
      ...p,
      nodes: nodesByProcess.get(p.id) ?? [],
      edges: edgesByProcess.get(p.id) ?? [],
    }));
  }

  if (modules.includes('application')) {
    const appDetails = await db.select({
      id: applications.id,
      name: applications.name,
      displayName: applications.displayName,
      actions: applications.actions,
      decisions: applications.decisions,
    })
      .from(applications)
      .where(eq(applications.projectId, projectId));

    const pagesList = await db.select().from(pages)
      .innerJoin(applications, eq(pages.applicationId, applications.id))
      .where(eq(applications.projectId, projectId));

    const pagesByApp = new Map<string, unknown[]>();
    for (const row of pagesList) {
      const appId = row.applications.id;
      if (!pagesByApp.has(appId)) pagesByApp.set(appId, []);
      pagesByApp.get(appId)!.push(row.pages);
    }

    (base.application as typeof base.application & { applicationDetails?: unknown }).applicationDetails = appDetails.map(a => ({
      ...a,
      pages: pagesByApp.get(a.id) ?? [],
    }));
  }

  if (modules.includes('architecture')) {
    const archDetails = await db.select().from(businessArchitectures)
      .where(eq(businessArchitectures.projectId, projectId));
    (base.architecture as typeof base.architecture & { architectureDetails?: unknown }).architectureDetails = archDetails;
  }

  return base;
}

// ============================================================
// Public API
// ============================================================

/**
 * 获取项目快照。
 *
 * @param db - Drizzle 数据库实例
 * @param projectId - 项目 ID
 * @param params - 快照参数（level + modules）
 * @returns 项目快照数据
 */
export async function getProjectSnapshot(
  db: Db,
  projectId: string,
  params: SnapshotParams = { level: 0 },
) {
  if (params.level === 1 && params.modules && params.modules.length > 0) {
    return getLevel1Snapshot(db, projectId, params.modules);
  }
  return getLevel0Snapshot(db, projectId);
}
