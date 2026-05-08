// ============================================
// Data Flow Types — 对应 data_flow_metadata 表
// ============================================

export interface DataFlowMetadata {
  id: string;
  projectId: string;
  fieldId: string;
  sources: unknown[];
  destinations: unknown[];
  notes: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
