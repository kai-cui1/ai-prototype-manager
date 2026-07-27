/**
 * @module pages/AdminAuditLogsPage
 * @description 审计日志页（F-M6-22）：按事件类型/操作人筛选 + 分页表格。仅 SuperAdmin。
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, Search } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  userId: string | null;
  eventType: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const EVENT_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'auth', label: 'auth.*' },
  { value: 'team', label: 'team.*' },
  { value: 'project', label: 'project.*' },
  { value: 'admin', label: 'admin.*' },
];

function getCategoryBadge(eventType: string) {
  if (eventType.startsWith('auth')) return { variant: 'default' as const, label: eventType };
  if (eventType.startsWith('team')) return { variant: 'secondary' as const, label: eventType };
  if (eventType.startsWith('project')) return { variant: 'outline' as const, label: eventType };
  return { variant: 'destructive' as const, label: eventType };
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '50' };
      if (eventType !== 'all') params.eventType = eventType;
      const res = await apiClient.get('/admin/audit-logs', { params });
      setLogs(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch {
      toast.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, eventType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ScrollText className="h-5 w-5" />
          审计日志
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">查看系统安全事件和操作记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <Select value={eventType} onValueChange={(v) => { setEventType(v ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="事件类型" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <Search className="mr-1 h-4 w-4" />
          查询
        </Button>
      </div>

      {/* 日志表格 */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">所选条件下无审计记录</div>
      ) : (
        <div className="rounded-lg border">
          <div className="grid grid-cols-[140px_1fr_180px_1fr] gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>时间</span>
            <span>操作人</span>
            <span>事件类型</span>
            <span>详情</span>
          </div>
          {logs.map((log) => {
            const badge = getCategoryBadge(log.eventType);
            return (
              <div key={log.id} className="grid grid-cols-[140px_1fr_180px_1fr] items-center gap-2 border-b px-4 py-2.5 text-sm last:border-0 hover:bg-muted/50">
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="truncate text-xs">{log.userId || '—'}</span>
                <Badge variant={badge.variant} className="w-fit text-xs">{badge.label}</Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {log.details ? JSON.stringify(log.details) : log.resource}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {Math.ceil(total / 50)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
