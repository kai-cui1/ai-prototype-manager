// ============================================
// Process Types — 对应 business_processes / process_nodes / process_edges / process_node_map
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
  branches: Array<{ name: string; condition?: string; outputs?: string[] }>;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  mappings: Array<Record<string, unknown>>;
  label: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessNodeMap {
  id: string;
  processId: string;
  nodeId: string;
  sortOrder: number;
  createdAt: string;
}
