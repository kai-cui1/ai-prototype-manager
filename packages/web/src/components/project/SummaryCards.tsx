/**
 * @module SummaryCards
 * @description 项目摘要统计卡片组：6 个模块计数展示（响应式网格）。
 *              对应 F-M1-03 详情页 Zone 3（摘要统计区域）。
 *
 * 原型视觉规格：
 * - 图标容器：44×44px，圆角 10px
 * - 数值：22px / font-weight 600
 * - 标签：12px / text-tertiary
 * - 卡片间距：16px，内边距 20px
 *
 * B-M1-15: 零计数显示为 0，不省略字段。
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

/** 摘要卡片定义：图标 + 标签 + 值提取 + 视觉色（原型规格） */
const SUMMARY_ITEMS = [
  { icon: Boxes, label: '领域模型', key: 'domainEntityCount' as const, bg: '#e6f4ff', color: '#1677ff' },
  { icon: GitBranch, label: '业务流程', key: 'processCount' as const, bg: '#f6ffed', color: '#52c41a' },
  { icon: Building2, label: '公司/组织', key: 'companyCount' as const, bg: '#fff7e6', color: '#fa8c16' },
  { icon: Users, label: '部门', key: 'departmentCount' as const, bg: '#e6f4ff', color: '#1677ff' },
  { icon: Shield, label: '角色', key: 'roleCount' as const, bg: '#f6ffed', color: '#52c41a' },
  { icon: UserPlus, label: '外部实体', key: 'externalEntityCount' as const, bg: '#fff7e6', color: '#fa8c16' },
] as const;

/**
 * 摘要统计卡片组件。
 *
 * 原型规格：图标容器 44×44px 圆角 10px + 语义背景色 + 22px 数值。
 * B-M1-15: 零计数正常显示为 "0"。
 */
export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SUMMARY_ITEMS.map((item) => (
        <Card key={item.key}>
          <CardContent className="p-5 flex items-center gap-4">
            {/* 原型：44×44px 圆角 10px 图标容器 */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: item.bg, color: item.color }}
            >
              <item.icon style={{ width: 22, height: 22 }} />
            </div>
            <div className="min-w-0">
              {/* 原型：数值 22px / 600 */}
              <p className="text-[22px] font-semibold leading-tight tabular-nums text-text-primary">
                {summary[item.key]}
              </p>
              {/* 原型：标签 12px / text-tertiary */}
              <p className="text-xs text-text-tertiary mt-1">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
