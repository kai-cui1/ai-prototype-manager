/**
 * @module SummaryCards
 * @description 项目摘要统计卡片组：7 个模块计数展示（响应式网格）。
 *              对应 F-M1-03 详情页 Zone 3（摘要统计区域）。
 *              F-M1-11: 应用管理卡片特殊样式（总数 + 类型分布 + 整张可点击跳转）。
 *
 * 原型视觉规格：
 * - 图标容器：44×44px，圆角 10px
 * - 数值：22px / font-weight 600
 * - 标签：12px / text-tertiary
 * - 卡片间距：16px，内边距 20px
 *
 * B-M1-15: 零计数显示为 0，不省略字段。
 *
 * 交互设计 Reference: project-management-interaction.md §4.3（2026-06-02 更新）
 * - 所有卡片：整张卡片 cursor-pointer + hover:shadow-md，点击跳转对应管理模块
 * - 领域模型/业务流程：Phase 1 占位，点击弹出 Toast 提示"功能正在开发中"
 * - 应用管理卡片：总数 + 各类型分布标签（仅展示 > 0 的类型）
 */
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProjectSummary } from '@apm/shared';
import { Card, CardContent } from '@/components/ui/card';
import {
  Boxes,
  GitBranch,
  Building2,
  Users,
  Shield,
  UserPlus,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  summary: ProjectSummary;
}

/** 应用类型显示名称（与 ApplicationsPage TypeBadge 保持一致） */
const APP_TYPE_LABEL: Record<string, string> = {
  web:     'Web',
  wxapp:   '小程序',
  android: 'Android',
  ios:     'iOS',
  pc:      'PC',
  api:     'API',
  service: '服务',
};

/** 类型显示顺序（按常见度排序） */
const APP_TYPE_ORDER = ['web', 'wxapp', 'android', 'ios', 'pc', 'api', 'service'];

/** 普通统计卡片定义：图标 + 标签 + 值提取 + 视觉色 + 目标路由 */
const SUMMARY_ITEMS = [
  { icon: Boxes,     label: '领域模型',  key: 'domainEntityCount'   as const, bg: '#e6f4ff', color: '#1677ff', route: 'domain-model',      comingSoon: false },
  { icon: GitBranch, label: '业务流程',  key: 'processCount'        as const, bg: '#f6ffed', color: '#52c41a', route: 'business-processes', comingSoon: true  },
  { icon: Building2, label: '公司/组织', key: 'companyCount'        as const, bg: '#fff7e6', color: '#fa8c16', route: 'organization',        comingSoon: false },
  { icon: Users,     label: '部门',      key: 'departmentCount'     as const, bg: '#e6f4ff', color: '#1677ff', route: 'organization',        comingSoon: false },
  { icon: Shield,    label: '角色',      key: 'roleCount'           as const, bg: '#f6ffed', color: '#52c41a', route: 'roles',               comingSoon: false },
  { icon: UserPlus,  label: '外部实体',  key: 'externalEntityCount' as const, bg: '#fff7e6', color: '#fa8c16', route: 'external-entities',   comingSoon: false },
] as const;

/**
 * 应用管理概要卡片（特殊）。
 *
 * 与普通卡片的差异：
 * - 统计：总数 + 非零类型标签行
 * - 交互：整张卡片 cursor-pointer，点击跳转应用管理页
 */
function ApplicationSummaryCard({ summary, projectId }: { summary: ProjectSummary; projectId: string }) {
  const navigate = useNavigate();
  const { applicationCount, applicationTypeBreakdown } = summary;

  // 按固定顺序过滤出数量 > 0 的类型，最多显示 4 个
  const typeEntries = APP_TYPE_ORDER
    .filter((t) => (applicationTypeBreakdown[t] ?? 0) > 0)
    .slice(0, 4)
    .map((t) => ({ type: t, count: applicationTypeBreakdown[t] }));

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/p/${projectId}/applications`)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        {/* 图标容器：与其他卡片规格一致 */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff0f6', color: '#c41d7f' }}
        >
          <Layers style={{ width: 22, height: 22 }} />
        </div>
        <div className="min-w-0">
          {/* 总数行 */}
          <p className={cn(
            'text-[22px] font-semibold leading-tight tabular-nums',
            applicationCount === 0 ? 'text-text-tertiary text-base' : 'text-text-primary',
          )}>
            {applicationCount === 0 ? '暂无应用' : `${applicationCount} 个应用`}
          </p>
          {/* 类型分布标签行（仅 total > 0 时显示） */}
          {typeEntries.length > 0 && (
            <p className="text-xs text-text-tertiary mt-1 truncate">
              {typeEntries.map((e) => `${APP_TYPE_LABEL[e.type] ?? e.type}×${e.count}`).join('  ')}
            </p>
          )}
          {/* total = 0 时显示模块标签 */}
          {applicationCount === 0 && (
            <p className="text-xs text-text-tertiary mt-1">应用管理</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 摘要统计卡片组件。
 *
 * 原型规格：图标容器 44×44px 圆角 10px + 语义背景色 + 22px 数值。
 * B-M1-15: 零计数正常显示为 "0"。
 * 应用管理卡片特殊处理：见 ApplicationSummaryCard。
 * 所有卡片可点击跳转：见 project-management-interaction.md §4.3。
 */
export function SummaryCards({ summary }: SummaryCardsProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  function handleCardClick(route: string, label: string, comingSoon: boolean) {
    if (comingSoon) {
      toast.info(`${label}功能正在开发中`);
      return;
    }
    navigate(`/p/${projectId}/${route}`);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 应用管理：特殊卡片（总数 + 类型分布 + 点击跳转） */}
      <ApplicationSummaryCard summary={summary} projectId={projectId ?? ''} />

      {/* 其他模块：普通统计卡片 */}
      {SUMMARY_ITEMS.map((item) => (
        <Card
          key={item.key}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => handleCardClick(item.route, item.label, item.comingSoon)}
        >
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
