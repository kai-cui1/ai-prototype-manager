/**
 * @module pages/AgentChatPage
 * @description M7 内置 Agent 对话主页：会话列表 + 消息流 + 输入区。
 *
 * 路由：/agent（顶级 — 会话可跨项目）
 *
 * 关键设计：
 * - 顶栏包含项目 selector（S3 §4 @ 上下文菜单依赖 projectId）
 * - projectId 存 localStorage 以便刷新恢复
 * - 流式过程使用临时 assistantId，message_end 后 refetch 消息覆盖
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import SessionList from '@/components/agent/SessionList';
import MessageStream from '@/components/agent/MessageStream';
import InputBar from '@/components/agent/InputBar';
import type { ContextRef } from '@/components/agent/ContextMenu';
import {
  createSession,
  listSessions,
  listMessages,
  updateSession,
  sendChatMessage,
} from '@/lib/agent-api';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { AgentSession, AgentMessage, SessionMode } from '@/types/agent';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
const PROJECT_STORAGE_KEY = 'apm_agent_selected_project';

interface ProjectOption {
  id: string;
  name: string;
  displayName?: string | null;
}

export default function AgentChatPage() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<AgentMessage | null>(null);
  const [cardMap, setCardMap] = useState<Record<string, { cardId: string; title: string; itemCount: number }>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    return localStorage.getItem(PROJECT_STORAGE_KEY) || null;
  });
  const abortRef = useRef<AbortController | null>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;

  // 初始加载会话列表
  useEffect(() => {
    (async () => {
      try {
        const list = await listSessions();
        setSessions(list);
        if (list.length > 0 && !currentSessionId) {
          const active = list.find((s) => s.status === 'active');
          if (active) setCurrentSessionId(active.id);
        }
      } catch (err) {
        toast.error(`会话列表加载失败: ${(err as Error).message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载项目列表供 @ 菜单使用
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{
          data: Array<{ id: string; name: string; displayName?: string | null }>;
        }>('/projects', { params: { pageSize: 100, status: 'active' } });
        const list = (res.data.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName ?? null,
        }));
        setProjects(list);
        // 校验存储的项目 ID 仍然存在
        if (selectedProjectId && !list.find((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(null);
          localStorage.removeItem(PROJECT_STORAGE_KEY);
        }
      } catch (err) {
        // 项目列表加载失败不阻塞对话，仅提示 @ 菜单不可用
        toast.error(`项目列表加载失败: ${(err as Error).message}（@ 引用暂不可用）`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProject = useCallback((id: string | null) => {
    const value = id === '__none__' || id === null ? null : id;
    setSelectedProjectId(value);
    if (value) localStorage.setItem(PROJECT_STORAGE_KEY, value);
    else localStorage.removeItem(PROJECT_STORAGE_KEY);
  }, []);

  // 切换 session 时加载消息
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      setCardMap({});
      return;
    }
    setLoading(true);
    listMessages(currentSessionId)
      .then((msgs) => {
        setMessages(msgs);
        // TODO: 后端目前不返回消息关联的卡片，只能在会话内新产生的卡片显示（历史消息卡片无法恢复）
      })
      .catch((err) => toast.error(`消息加载失败: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }, [currentSessionId]);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch (err) {
      toast.error(`会话刷新失败: ${(err as Error).message}`);
    }
  }, []);

  const handleCreateSession = useCallback(async () => {
    try {
      const created = await createSession();
      setSessions((prev) => [created, ...prev]);
      setCurrentSessionId(created.id);
      setMessages([]);
      setCardMap({});
    } catch (err) {
      toast.error(`创建会话失败: ${(err as Error).message}`);
    }
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    // 中断进行中的 SSE
    abortRef.current?.abort();
    setStreamingMessage(null);
    setCurrentSessionId(id);
  }, []);

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await updateSession(id, { status: 'archived' });
        toast.success('会话已归档');
        if (id === currentSessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        await refreshSessions();
      } catch (err) {
        toast.error(`归档失败: ${(err as Error).message}`);
      }
    },
    [currentSessionId, refreshSessions],
  );

  const handleModeChange = useCallback(
    async (mode: SessionMode) => {
      if (!currentSessionId) return;
      try {
        const updated = await updateSession(currentSessionId, { mode });
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } catch (err) {
        toast.error(`模式切换失败: ${(err as Error).message}`);
      }
    },
    [currentSessionId],
  );

  const handleSend = useCallback(
    async (content: string, refs: ContextRef[]) => {
      if (!currentSessionId) return;

      // 构造发送到后端的 contextRefs（丢掉 UI 内部 key 字段）
      const outboundRefs = refs.map((r) => ({
        area: r.area,
        label: r.label,
        data: r.data,
      }));

      // 立即追加临时 user 消息（乐观更新）
      const tempUserMsg: AgentMessage = {
        id: `temp-user-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content,
        contextRefs: outboundRefs.length > 0 ? outboundRefs : null,
        tokenCount: 0,
        isCompressed: false,
        compressedContent: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      setSending(true);
      const controller = new AbortController();
      abortRef.current = controller;

      let assistantId: string | null = null;

      try {
        await sendChatMessage(
          {
            sessionId: currentSessionId,
            content,
            contextRefs: outboundRefs.length > 0 ? outboundRefs : undefined,
          },
          (evt) => {
            switch (evt.event) {
              case 'message_start':
                assistantId = evt.data.messageId;
                setStreamingMessage({
                  id: evt.data.messageId,
                  sessionId: currentSessionId,
                  role: 'assistant',
                  content: '',
                  contextRefs: null,
                  tokenCount: 0,
                  isCompressed: false,
                  compressedContent: null,
                  createdAt: new Date().toISOString(),
                });
                break;
              case 'content_delta':
                setStreamingMessage((prev) =>
                  prev ? { ...prev, content: prev.content + evt.data.delta } : prev,
                );
                break;
              case 'card_ready':
                if (assistantId) {
                  const meta = evt.data;
                  setCardMap((prev) => ({ ...prev, [assistantId!]: meta }));
                }
                break;
              case 'message_end':
                // 流式结束：refetch 完整消息覆盖临时状态
                break;
              case 'error':
                toast.error(evt.data.message);
                break;
            }
          },
          controller.signal,
        );

        // 结束后拉取真实消息 + 会话列表
        const [msgs, sessList] = await Promise.all([
          listMessages(currentSessionId),
          listSessions(),
        ]);
        setMessages(msgs);
        setSessions(sessList);
        setStreamingMessage(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        toast.error(`发送失败: ${(err as Error).message}`);
        setStreamingMessage(null);
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [currentSessionId],
  );

  // 若尚无会话，进入页面自动创建一个
  useEffect(() => {
    if (sessions.length === 0) return;
    if (!currentSessionId && sessions.find((s) => s.status === 'active')) {
      const first = sessions.find((s) => s.status === 'active');
      if (first) setCurrentSessionId(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  void DEFAULT_USER_ID; // 占位：MVP 单用户，userId 由后端注入

  return (
    <div className="flex h-[calc(100vh-var(--header-height,3rem))] -m-[var(--content-padding)] bg-background">
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={handleSelectSession}
        onCreate={handleCreateSession}
        onArchive={handleArchive}
      />

      <div className="flex flex-1 flex-col">
        {/* 顶部标题栏 + 项目 selector */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-background gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🤖</span>
            <span className="text-base font-semibold truncate">
              {currentSession?.title || 'AI 助手'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">项目上下文</span>
            <Select
              value={selectedProjectId ?? '__none__'}
              onValueChange={handleSelectProject}
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="选择项目（@ 引用用）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— 不设置项目 —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <MessageStream
          messages={messages}
          streamingMessage={streamingMessage}
          cardMap={cardMap}
          loading={loading}
        />

        <InputBar
          mode={currentSession?.mode ?? 'copilot'}
          projectId={selectedProjectId}
          onModeChange={handleModeChange}
          onSend={handleSend}
          sending={sending}
          disabled={!currentSessionId}
        />
      </div>
    </div>
  );
}
