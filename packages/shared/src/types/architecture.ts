// ============================================
// Architecture Types — 对应 business_architectures / biz_arch_process_map
// ============================================

export type ArchitectureLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface BusinessArchitecture {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  level: ArchitectureLevel;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BizArchProcessMap {
  id: string;
  architectureId: string;
  processId: string;
  sortOrder: number;
  createdAt: string;
}
