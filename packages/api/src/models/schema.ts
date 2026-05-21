import { pgTable, text, integer, timestamp, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ============================================
// Table 1: projects — 项目主表
// ============================================
export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active | archived
  version: integer('version').notNull().default(1),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Table 2: domain_entities — 领域实体表
// ============================================
export const domainEntities = pgTable('domain_entities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('domain_entities_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 3: entity_fields — 实体字段表
// ============================================
export const entityFields = pgTable('entity_fields', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  entityId: text('entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  fieldType: text('field_type').notNull(),
  // R5 Why: is_required 用 boolean 类型（非 text），与 DDL 定义和 shared type EntityField.isRequired 一致。
  isRequired: boolean('is_required').notNull().default(false),
  defaultValue: jsonb('default_value'),
  constraints: jsonb('constraints').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('entity_fields_entity_name_unique').on(table.entityId, table.name),
]);

// ============================================
// Table 4: entity_relations — 实体关系表
// ============================================
export const entityRelations = pgTable('entity_relations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceEntityId: text('source_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  targetEntityId: text('target_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  // R5 Why: relation_kind 限制为三种语义关系类型（dependency/aggregation/composition），
  //        拒绝 UML 双向关联——每条记录表达一个方向的关系语义。
  //        枚举值由 TypeBox Schema（P2）+ Service 层校验，不使用 DB 级 CHECK 约束。
  relationKind: text('relation_kind').notNull(), // dependency | aggregation | composition
  targetCardinality: text('target_cardinality').notNull().default('*'),
  displayName: text('display_name'),
  description: text('description'),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('entity_relations_project_source_target_kind_unique')
    .on(table.projectId, table.sourceEntityId, table.targetEntityId, table.relationKind),
]);

// ============================================
// Table 5: data_flow_metadata — 数据流元数据表
// ============================================
/**
 * @module dataFlowMetadata
 * @description 记录每个字段的数据来源和去向，支持数据流追踪。
 * R5 Why: 字段级别的数据血缘关系是原型设计中的核心分析维度，
 *        帮助理解数据在系统中的流转路径。
 */
export const dataFlowMetadata = pgTable('data_flow_metadata', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull().references(() => entityFields.id, { onDelete: 'cascade' }),
  sources: jsonb('sources').default('[]'),
  destinations: jsonb('destinations').default('[]'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('data_flow_metadata_project_field_unique').on(table.projectId, table.fieldId),
]);

// ============================================
// Table 6: business_processes — 业务流程表
// ============================================
/**
 * @module businessProcesses
 * @description 定义业务流程的入口、出口、版本及层级结构。
 * R5 Why: 业务流程是原型设计的核心组织单元，parentProcessId 支持父子嵌套以表达流程分解。
 */
// @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
export const businessProcesses = pgTable('business_processes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'), // draft | active | deprecated
  version: integer('version').notNull().default(1),
  // R5 Why: parentProcessId 支持流程分解为子流程（如"订单处理"->"支付子流程"+"物流子流程"），
  //        SET NULL 保证删除父流程时子流程不级联删除（子流程可独立存在）。
  // @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
  parentProcessId: text('parent_process_id').references(() => businessProcesses.id, { onDelete: 'set null' }),
  entryNodeId: text('entry_node_id'),
  exitNodeIds: jsonb('exit_node_ids').default('[]'),
  config: jsonb('config').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_business_processes_project').on(table.projectId),
  index('idx_business_processes_parent').on(table.parentProcessId),
  uniqueIndex('business_processes_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 7: process_nodes — 流程节点表
// ============================================
/**
 * @module processNodes
 * @description 流程图中的动作节点或决策节点，关联持有者（角色/外部实体/服务）。
 * R5 Why: 节点是流程的最小执行单元。holderType + holderId 组合实现多态外键：
 *        角色/外部实体/系统服务均可持有节点，由应用层根据 holder_type 解析实际引用。
 */
export const processNodes = pgTable('process_nodes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // R5 Why: nodeType 仅两种——action（执行操作）和 decision（条件分支），
  //        Start/End 由 businessProcesses 的 entryNodeId / exitNodeIds 隐式定义。
  //        枚举值由 TypeBox Schema + Service 层校验。
  nodeType: text('node_type').notNull(), // action | decision
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  // R5 Why: holderType 决定 holder_id 引用哪张表：
  //        'role' -> roles.id, 'external_entity' -> external_entities.id, 'service' -> applications.id(type='service')
  //        不使用 DB 级 FK 约束，由 Service 层根据 holder_type 做应用级校验。
  //        枚举值由 TypeBox Schema + Service 层校验。
  holderType: text('holder_type').notNull(), // role | external_entity | service
  holderId: text('holder_id').notNull(),
  branches: jsonb('branches').default('[]'),
  inputs: jsonb('inputs').default('[]'),
  outputs: jsonb('outputs').default('[]'),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_process_nodes_project').on(table.projectId),
  index('idx_process_nodes_holder').on(table.projectId, table.holderType, table.holderId),
]);

// ============================================
// Table 8: process_edges — 流程边（连接）表
// ============================================
/**
 * @module processEdges
 * @description 连接两个流程节点，携带数据映射、标签和条件表达式。
 * R5 Why: 边定义了节点间的流转规则，condition 控制决策分支走向。
 *        自环（source == target）和间接环由 Service 层 DFS 检测。
 */
export const processEdges = pgTable('process_edges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceNodeId: text('source_node_id').notNull().references(() => processNodes.id, { onDelete: 'cascade' }),
  targetNodeId: text('target_node_id').notNull().references(() => processNodes.id, { onDelete: 'cascade' }),
  mappings: jsonb('mappings').default('[]'),
  label: text('label'),
  condition: text('condition'),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_process_edges_project').on(table.projectId),
  index('idx_process_edges_source').on(table.sourceNodeId),
  index('idx_process_edges_target').on(table.targetNodeId),
]);

// ============================================
// Table 9: process_node_map — 流程-节点关联表（多对多）
// ============================================
/**
 * @module processNodeMap
 * @description 业务流程与流程节点的多对多映射，支持排序。
 * R5 Why: 同一节点可被多个流程复用（全局节点池模式），独立映射表避免冗余且支持灵活编排。
 *        无 updatedAt 字段——此表纯为关联用途，不承载业务状态变更。
 */
export const processNodeMap = pgTable('process_node_map', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processId: text('process_id').notNull().references(() => businessProcesses.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull().references(() => processNodes.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_process_node_map_process').on(table.processId),
  index('idx_process_node_map_node').on(table.nodeId),
  uniqueIndex('process_node_map_process_node_unique').on(table.processId, table.nodeId),
]);

// ============================================
// Table 10: applications — 应用表
// ============================================
/**
 * @module applications
 * @description 项目下的应用定义（Web/小程序/App/API服务等），作为页面的容器。
 * R5 Why: 一个项目可包含多个端应用，type 决定代码生成时的技术栈模板选择。
 */
export const applications = pgTable('applications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  // R5 Why: type 约束应用类型范围，影响代码生成时的框架选择和目录结构。
  //        枚举值由 TypeBox Schema + Service 层校验。
  type: text('type').notNull().default('web'), // web | wxapp | android | ios | pc | api | service
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('applications_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 11: pages — 页面表
// ============================================
/**
 * @module pages
 * @description 应用内的页面定义，关联业务流程以驱动页面内容生成。
 * R5 Why: 页面是原型的最终呈现单元，pageType 决定 UI 容器形态（页面/弹窗/抽屉/浮层等）。
 */
export const pages = pgTable('pages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  pageType: text('page_type').notNull().default('page'), // page | modal | drawer | overlay
  routePath: text('route_path'),
  associatedProcessId: text('associated_process_id').references(() => businessProcesses.id, { onDelete: 'set null' }),
  layoutConfig: jsonb('layout_config').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_pages_application').on(table.applicationId),
  uniqueIndex('pages_application_name_unique').on(table.applicationId, table.name),
]);

// ============================================
// Table 12: page_layout_regions — 页面布局区域表
// ============================================
/**
 * @module pageLayoutRegions
 * @description 将页面拆分为 header/sidebar/main/footer/custom 等区域，支持组件放置。
 * R5 Why: 布局区域化使页面结构模块化，每个区域可独立配置组件排列方式（CSS grid/flex）。
 */
export const pageLayoutRegions = pgTable('page_layout_regions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  regionType: text('region_type').notNull(), // header | sidebar | main | footer | custom
  regionName: text('region_name').notNull(),
  layoutConfig: jsonb('layout_config').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('page_layout_regions_page_region_unique').on(table.pageId, table.regionName),
]);

// ============================================
// Table 13: companies — 公司/组织表
// ============================================
/**
 * @module companies
 * @description 项目涉及的公司或组织单位，作为部门和角色的顶层容器。
 * R5 Why: 组织架构建模从公司开始，companyType 区分内外部伙伴关系（内部/外部/合作伙伴/客户）。
 */
export const companies = pgTable('companies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  companyType: text('company_type'), // internal | external | partner | client
  contactInfo: jsonb('contact_info').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_companies_project').on(table.projectId),
  uniqueIndex('companies_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 14: departments — 部门表
// ============================================
/**
 * @module departments
 * @description 公司下的部门，支持多级树形结构（parentId 自引用）。
 * R5 Why: 部门是角色归属的中间层，parentId 自引用实现部门的多级嵌套（集团->事业部->中心->组），
 *        SET NULL 保证删除父部门时子部门不级联删除（子部门可提升或重新挂载）。
 */
// @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
export const departments = pgTable('departments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // R5 Why: parentId 自引用实现部门多级树（集团->事业部->中心->组），SET NULL 避免级联删除。
  // @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
  parentId: text('parent_id').references(() => departments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  contactInfo: jsonb('contact_info').default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_departments_project').on(table.projectId),
  index('idx_departments_company').on(table.companyId),
  index('idx_departments_parent').on(table.parentId),
  uniqueIndex('departments_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 15: roles — 角色表
// ============================================
/**
 * @module roles
 * @description 部门下的角色定义，记录角色可执行的动作和决策点。
 * R5 Why: 角色连接组织架构与流程节点（通过 process_nodes 的 holder 多态），
 *        actions/decisions 为 Phase 1 占位字段，后续 Phase 追溯权限边界。
 */
export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // R5 Why: departmentId 可选（nullable），与 domain model v1.1 Role 独立性设计一致：
  //        角色可独立于部门存在（如"系统管理员"等全局角色），通过独立 Tab 入口管理。
  //        FK 用 SET NULL：删除部门时角色保留但解除关联。
  departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category'), // internal | external | system
  contactInfo: jsonb('contact_info').default('{}'),
  actions: jsonb('actions').default('[]'),
  decisions: jsonb('decisions').default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_roles_project').on(table.projectId),
  index('idx_roles_department').on(table.departmentId),
  uniqueIndex('roles_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 16: external_entities — 外部实体表
// ============================================
/**
 * @module externalEntities
 * @description 系统交互的外部参与者（系统/组织/人员/API），可选挂载到公司或部门。
 * R5 Why: 外部实体是流程图中与内部角色对等的参与者，entityType 区分交互对象性质。
 *        company_id 和 department_id 均可选（SET NULL），支持仅挂载到项目级别的外部实体。
 */
export const externalEntities = pgTable('external_entities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
  departmentId: text('department_id').references(() => departments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  entityType: text('entity_type'), // system | organization | person | api
  contactInfo: jsonb('contact_info').default('{}'),
  actions: jsonb('actions').default('[]'),
  decisions: jsonb('decisions').default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_external_entities_project').on(table.projectId),
  uniqueIndex('external_entities_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 17: business_architectures — 业务架构表
// ============================================
/**
 * @module businessArchitectures
 * @description 分层业务能力架构（L1-L4），支持树形分解。
 * R5 Why: 业务架构提供战略层到执行层的分层视图（L1领域->L2能力域->L3能力->L4功能组），
 *        level 枚举值由 TypeBox Schema + Service 层校验。parentId 用 CASCADE（与 departments 不同）——
 *        删除父架构节点意味着该分类不再有意义，其下所有子分类应一并清除。
 */
// @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
export const businessArchitectures = pgTable('business_architectures', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  // R5 Why: parentId 自引用实现架构能力逐级分解（L1领域 -> L2能力域 -> L3能力 -> L4功能），CASCADE 删除。
  // @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
  parentId: text('parent_id').references(() => businessArchitectures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  // R5 Why: level 限制为 L1-L4 四个层次，枚举值由 TypeBox Schema + Service 层校验。
  level: text('level').notNull(), // L1 | L2 | L3 | L4
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_business_architectures_project').on(table.projectId),
  index('idx_business_architectures_parent').on(table.parentId),
  uniqueIndex('business_architectures_project_name_unique').on(table.projectId, table.name),
]);

// ============================================
// Table 18: biz_arch_process_map — 架构-流程关联表（多对多）
// ============================================
/**
 * @module bizArchProcessMap
 * @description 业务架构节点与业务流程的多对多映射，表达"某能力由哪些流程支撑"。
 * R5 Why: 架构与流程的映射是实现从战略到执行的追溯关键。
 *        无 updatedAt 字段——纯关联表，不承载业务状态变更。
 */
export const bizArchProcessMap = pgTable('biz_arch_process_map', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  architectureId: text('architecture_id').notNull().references(() => businessArchitectures.id, { onDelete: 'cascade' }),
  processId: text('process_id').notNull().references(() => businessProcesses.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_bizarch_process_map_arch').on(table.architectureId),
  index('idx_bizarch_process_map_process').on(table.processId),
  uniqueIndex('bizarch_process_map_arch_process_unique').on(table.architectureId, table.processId),
]);

// ============================================
// Table 19: menus — 全局菜单表
// ============================================
/**
 * @module menus
 * @description 全局菜单树，支持无限层级自引用。注意：无 project_id，属于全局系统配置。
 * R5 Why: 菜单是应用导航的结构化定义，menuType 区分三种形态：
 *        menu（可点击导航）、directory（可展开目录）、separator（分隔线）。
 *        visible 控制 UI 显隐，roles/permissions 为 Phase 3 权限控制预留。
 */
// @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
export const menus = pgTable('menus', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // @ts-expect-error -- self-referencing FK requires circular reference (resolved at runtime)
  parentId: text('parent_id').references(() => menus.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  icon: text('icon'),
  path: text('path'),
  // R5 Why: menuType 区分三种形态，枚举值由 TypeBox Schema + Service 层校验。
  menuType: text('menu_type').notNull().default('menu'), // menu | directory | separator
  sortOrder: integer('sort_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
  roles: jsonb('roles').default('[]'),
  permissions: jsonb('permissions').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_menus_parent').on(table.parentId),
]);
