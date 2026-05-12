/**
 * @module SummaryCards
 * @description 项目摘要统计卡片组：6 个模块计数展示（2×3 响应式网格）。
 *              对应 F-M1-03 详情页 Zone 3（摘要统计区域）。
 *
 * B-M1-15: 零计数显示为 0，不省略字段。
 * 颜色使用 §2.3 实体类型语义色 token（entity-*）。
 */
import type { ProjectSummary } from '@apm/shared';
import { Card, CardContent } from '@/components/ui/card';
import {
  Boxes,
  GitBranch,
  Building2,
  Users,
  Shield,
  UserPlus,
} from 'lucide-react';

interface SummaryCardsProps {
  summary: ProjectSummary;
}

/** 摘要卡片定义：图标 + 标签 + 值提取 + 语义色 */
const SUMMARY_ITEMS = [
  { icon: Boxes, label: '领域实体', key: 'domainEntityCount' as const, color: 'text-entity-domain' },
  { icon: GitBranch, label: '业务流程', key: 'processCount' as const, color: 'text-entity-process' },
  { icon: Building2, label: '公司/组织', key: 'companyCount' as const, color: 'text-entity-company' },
  { icon: Users, label: '部门', key: 'departmentCount' as const, color: 'text-entity-department' },
  { icon: Shield, label: '角色', key: 'roleCount' as const, color: 'text-entity-role' },
  { icon: UserPlus, label: '外部实体', key: 'externalEntityCount' as const, color: 'text-entity-external' },
] as const;

/**
 * 摘要统计卡片组件。
 *
 * 6 个计数卡片以 2×3 网格排列，每个卡片含图标(语义色) + 标签 + 数值。
 * B-M1-15: 零计数正常显示为 "0"。
 */
export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {SUMMARY_ITEMS.map((item) => (
        <Card key={item.key}>
          <CardContent className="p-4 flex items-center gap-3">
            <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
            <div className="min-w-0">
              <p className="text-xs text-text-secondary">{item.label}</p>
              {/* B-M1-15: 零计数必须显示 */}
              <p className="text-xl font-semibold tabular-nums text-text-primary">
                {summary[item.key]}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
