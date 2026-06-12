// ============================================
// Process Types — 对应 business_processes / process_nodes / process_edges / process_layouts
// ============================================

export type ProcessStatus = 'draft' | 'active' | 'deprecated';
export type NodeType = 'action' | 'decision';
export type HolderType = 'role' | 'external_entity' | 'service';

export interface BusinessProcess {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProcessStatus;
  version: number;
  parentProcessId: string | null;
  entryNodeId: string | null;
  exitNodeIds: string[];
  nodeIds: string[];
  edgeIds: string[];
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessNode {
  id: string;
  projectId: string;
  nodeType: NodeType;
  name: string;
  displayName: string;
  description: string | null;
  holderType: HolderType;
  holderId: string;
  actionRef: string | null;
  decisionRef: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** 映射关系：source 输出字段 → target 输入字段 */
export interface EdgeMapping {
  sourceField: string;
  targetField: string;
}

export interface ProcessEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  mappings: EdgeMapping[];
  label: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type Orientation = 'participant-horizontal' | 'participant-vertical';

export interface ProcessLayout {
  id: string;
  processId: string;
  orientation: Orientation;
  participantLanes: ParticipantLane[];
  customLanes: CustomLane[];
  nodePositions: Record<string, NodePosition>;
  laneOverrides: Record<string, { size: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantLane {
  participantId: string;
  participantType: HolderType;
  label: string;
  order: number;
  size: number;
}

export interface CustomLane {
  id: string;
  name: string;
  label: string;
  order: number;
  size: number;
}

export interface NodePosition {
  participantLaneIndex: number;
  customLaneIndex: number;
  offsetX: number;
  offsetY: number;
}
