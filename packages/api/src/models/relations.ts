import { relations } from 'drizzle-orm';
import {
  projects,
  domainEntities,
  entityFields,
  entityRelations,
  dataFlowMetadata,
  businessProcesses,
  processNodes,
  processEdges,
  processLayouts,
  applications,
  pages,
  pageLayoutRegions,
  companies,
  departments,
  roles,
  externalEntities,
  businessArchitectures,
  bizArchProcessMap,
  menus,
} from './schema.js';

// ── Table 1: projects ──────────────────────────────────────
export const projectsRelations = relations(projects, ({ many }) => ({
  domainEntities: many(domainEntities),
  entityRelations: many(entityRelations),
  dataFlowMetadata: many(dataFlowMetadata),
  businessProcesses: many(businessProcesses),
  processNodes: many(processNodes),
  processEdges: many(processEdges),
  applications: many(applications),
  companies: many(companies),
  departments: many(departments),
  roles: many(roles),
  externalEntities: many(externalEntities),
  businessArchitectures: many(businessArchitectures),
}));

// ── Table 2: domain_entities ───────────────────────────────
export const domainEntitiesRelations = relations(domainEntities, ({ many, one }) => ({
  project: one(projects, {
    fields: [domainEntities.projectId],
    references: [projects.id],
  }),
  fields: many(entityFields),
  sourceRelations: many(entityRelations),
  targetRelations: many(entityRelations),
  dataFlowMetadata: many(dataFlowMetadata),
}));

// ── Table 3: entity_fields ─────────────────────────────────
export const entityFieldsRelations = relations(entityFields, ({ one, many }) => ({
  entity: one(domainEntities, {
    fields: [entityFields.entityId],
    references: [domainEntities.id],
  }),
  dataFlowMetadata: many(dataFlowMetadata),
}));

// ── Table 4: entity_relations ──────────────────────────────
export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  project: one(projects, {
    fields: [entityRelations.projectId],
    references: [projects.id],
  }),
  sourceEntity: one(domainEntities, {
    fields: [entityRelations.sourceEntityId],
    references: [domainEntities.id],
  }),
  targetEntity: one(domainEntities, {
    fields: [entityRelations.targetEntityId],
    references: [domainEntities.id],
  }),
}));

// ── Table 5: data_flow_metadata ────────────────────────────
export const dataFlowMetadataRelations = relations(dataFlowMetadata, ({ one }) => ({
  project: one(projects, {
    fields: [dataFlowMetadata.projectId],
    references: [projects.id],
  }),
  field: one(entityFields, {
    fields: [dataFlowMetadata.fieldId],
    references: [entityFields.id],
  }),
}));

// ── Table 6: business_processes ────────────────────────────
export const businessProcessesRelations = relations(businessProcesses, ({ many, one }) => ({
  project: one(projects, {
    fields: [businessProcesses.projectId],
    references: [projects.id],
  }),
  // R5 Why: 自引用关系——parentProcess 指向父流程，subProcesses 为反向集合。
  //        relationName 必须配对，Drizzle 用它识别双向关系的两个方向。
  parentProcess: one(businessProcesses, {
    fields: [businessProcesses.parentProcessId],
    references: [businessProcesses.id],
    relationName: 'business_processes_parent_child',
  }),
  subProcesses: many(businessProcesses, { relationName: 'business_processes_parent_child' }),
  pages: many(pages),
  architectureMappings: many(bizArchProcessMap),
}));

// ── Table 7: process_nodes ─────────────────────────────────
export const processNodesRelations = relations(processNodes, ({ many, one }) => ({
  project: one(projects, {
    fields: [processNodes.projectId],
    references: [projects.id],
  }),
  // R5 Why: process_edges 有 source_node_id 和 target_node_id 两个字段都指向 process_nodes，
  //        必须用不同 relationName 区分"作为出边起点"和"作为入边终点"两个关系。
  asSource: many(processEdges, { relationName: 'process_edges_source' }),
  asTarget: many(processEdges, { relationName: 'process_edges_target' }),
}));

// ── Table 8: process_edges ─────────────────────────────────
export const processEdgesRelations = relations(processEdges, ({ one }) => ({
  project: one(projects, {
    fields: [processEdges.projectId],
    references: [projects.id],
  }),
  sourceNode: one(processNodes, {
    fields: [processEdges.sourceNodeId],
    references: [processNodes.id],
    relationName: 'process_edges_source',
  }),
  targetNode: one(processNodes, {
    fields: [processEdges.targetNodeId],
    references: [processNodes.id],
    relationName: 'process_edges_target',
  }),
}));

// ── Table 9: process_layouts ───────────────────────────────
export const processLayoutsRelations = relations(processLayouts, ({ one }) => ({
  process: one(businessProcesses, {
    fields: [processLayouts.processId],
    references: [businessProcesses.id],
  }),
}));

// ── Table 10: applications ─────────────────────────────────
export const applicationsRelations = relations(applications, ({ many, one }) => ({
  project: one(projects, {
    fields: [applications.projectId],
    references: [projects.id],
  }),
  pages: many(pages),
}));

// ── Table 11: pages ────────────────────────────────────────
export const pagesRelations = relations(pages, ({ many, one }) => ({
  application: one(applications, {
    fields: [pages.applicationId],
    references: [applications.id],
  }),
  associatedProcess: one(businessProcesses, {
    fields: [pages.associatedProcessId],
    references: [businessProcesses.id],
  }),
  layoutRegions: many(pageLayoutRegions),
}));

// ── Table 12: page_layout_regions ──────────────────────────
export const pageLayoutRegionsRelations = relations(pageLayoutRegions, ({ one }) => ({
  page: one(pages, {
    fields: [pageLayoutRegions.pageId],
    references: [pages.id],
  }),
}));

// ── Table 13: companies ────────────────────────────────────
export const companiesRelations = relations(companies, ({ many, one }) => ({
  project: one(projects, {
    fields: [companies.projectId],
    references: [projects.id],
  }),
  departments: many(departments),
  externalEntities: many(externalEntities),
}));

// ── Table 14: departments ──────────────────────────────────
export const departmentsRelations = relations(departments, ({ many, one }) => ({
  project: one(projects, {
    fields: [departments.projectId],
    references: [projects.id],
  }),
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  // R5 Why: 自引用——parentId 实现部门多级树（集团→事业部→中心→组），
  //        relationName 配对 parent ↔ children。
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'departments_tree',
  }),
  children: many(departments, { relationName: 'departments_tree' }),
  roles: many(roles),
  externalEntities: many(externalEntities),
}));

// ── Table 15: roles ────────────────────────────────────────
export const rolesRelations = relations(roles, ({ one }) => ({
  project: one(projects, {
    fields: [roles.projectId],
    references: [projects.id],
  }),
  // R5 Why: departmentId 可选（nullable），与 domain model v1.1 Role 独立性设计一致。
  //        SET NULL：删除部门时角色保留但解除部门关联。
  department: one(departments, {
    fields: [roles.departmentId],
    references: [departments.id],
  }),
}));

// ── Table 16: external_entities ────────────────────────────
export const externalEntitiesRelations = relations(externalEntities, ({ one }) => ({
  project: one(projects, {
    fields: [externalEntities.projectId],
    references: [projects.id],
  }),
  company: one(companies, {
    fields: [externalEntities.companyId],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [externalEntities.departmentId],
    references: [departments.id],
  }),
}));

// ── Table 17: business_architectures ───────────────────────
export const businessArchitecturesRelations = relations(businessArchitectures, ({ many, one }) => ({
  project: one(projects, {
    fields: [businessArchitectures.projectId],
    references: [projects.id],
  }),
  // R5 Why: 自引用——parentId 实现架构能力逐级分解（L1领域→L2能力域→L3能力→L4功能组）。
  //        用 CASCADE 删除（与 departments 的 SET NULL 不同）：
  //        删除父架构节点意味着该分类不再有意义，子分类应一并清除。
  parent: one(businessArchitectures, {
    fields: [businessArchitectures.parentId],
    references: [businessArchitectures.id],
    relationName: 'business_architectures_tree',
  }),
  children: many(businessArchitectures, { relationName: 'business_architectures_tree' }),
  processMappings: many(bizArchProcessMap),
}));

// ── Table 18: biz_arch_process_map ─────────────────────────
export const bizArchProcessMapRelations = relations(bizArchProcessMap, ({ one }) => ({
  architecture: one(businessArchitectures, {
    fields: [bizArchProcessMap.architectureId],
    references: [businessArchitectures.id],
  }),
  process: one(businessProcesses, {
    fields: [bizArchProcessMap.processId],
    references: [businessProcesses.id],
  }),
}));

// ── Table 19: menus ────────────────────────────────────────
export const menusRelations = relations(menus, ({ many, one }) => ({
  // R5 Why: 自引用——parentId 支持无限层级菜单树，CASCADE 删除保证清理孤立菜单项。
  parent: one(menus, {
    fields: [menus.parentId],
    references: [menus.id],
    relationName: 'menus_tree',
  }),
  children: many(menus, { relationName: 'menus_tree' }),
}));
