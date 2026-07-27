/**
 * @module components/agent/InputBar
 * @description 输入区域：多行 textarea + 模式切换（副驾/执行者）+ @ 上下文引用 + 发送按钮
 *
 * S3 交互设计 §3.4 + §4：
 *   - 输入框上方渲染已选 chip（可删除）
 *   - @ 按钮 / 在输入框内键入 "@" 触发 ContextMenu
 *   - 发送时把 chip 转成 contextRefs 传给上层
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, AtSign, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import ContextMenu, { type ContextRef } from './ContextMenu';
import type { SessionMode } from '@/types/agent';

interface Props {
  mode: SessionMode;
  projectId: string | null;
  onModeChange: (mode: SessionMode) => void;
  onSend: (text: string, contextRefs: ContextRef[]) => void;
  sending: boolean;
  disabled?: boolean;
}

export default function InputBar({
  mode,
  projectId,
  onModeChange,
  onSend,
  sending,
  disabled,
}: Props) {
  const [text, setText] = useState('');
  const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    onSend(trimmed, contextRefs);
    setText('');
    setContextRefs([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !menuOpen) {
      e.preventDefault();
      send();
    }
  };

  // 键入 "@" 触发 ContextMenu（S3 §4.1）
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const prevLen = text.length;
    setText(next);
    // 检测新键入的 "@"（仅在光标位置的前一个字符为 @ 时触发，避免粘贴大段文本时误触发）
    if (
      !menuOpen &&
      next.length === prevLen + 1 &&
      next.slice(-1) === '@' &&
      projectId
    ) {
      setMenuOpen(true);
    }
  };

  const handleAtButton = () => {
    if (!disabled) setMenuOpen(true);
  };

  const handleConfirmRefs = useCallback((refs: ContextRef[]) => {
    setContextRefs((prev) => {
      const map = new Map<string, ContextRef>();
      for (const r of prev) map.set(r.key, r);
      for (const r of refs) map.set(r.key, r);
      return Array.from(map.values());
    });
    setMenuOpen(false);
    // 聚焦回输入框
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleRemoveRef = (key: string) => {
    setContextRefs((prev) => prev.filter((r) => r.key !== key));
  };

  // 自动增高
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 5 * 24)}px`;
    }
  }, [text]);

  const selectedKeys = new Set(contextRefs.map((r) => r.key));

  return (
    <div className="relative border-t border-border bg-background p-3">
      {/* @ 上下文菜单（绝对定位在 InputBar 上方） */}
      <ContextMenu
        open={menuOpen}
        projectId={projectId}
        selectedKeys={selectedKeys}
        onClose={() => setMenuOpen(false)}
        onConfirm={handleConfirmRefs}
      />

      {/* 模式指示器 */}
      <div className="mb-2 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                {mode === 'copilot' ? '🛡️ 副驾模式' : '⚡ 执行者模式'}
                <span className="text-muted-foreground">▼</span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem
              onClick={() => onModeChange('copilot')}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">{mode === 'copilot' && '✓ '}🛡️ 副驾模式</span>
              <span className="text-xs text-muted-foreground">推荐 + 引导，你确认后执行</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onModeChange('executor')}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">{mode === 'executor' && '✓ '}⚡ 执行者模式</span>
              <span className="text-xs text-muted-foreground">直接执行，高危操作才确认</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 已选上下文 chip 行（S3 §4.4） */}
      {contextRefs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {contextRefs.map((ref) => (
            <span
              key={ref.key}
              className="inline-flex items-center gap-1 bg-secondary rounded-full px-2 py-0.5 text-xs"
            >
              <span className="text-muted-foreground">{ref.area}</span>
              <span>·</span>
              <span className="truncate max-w-[180px]">{ref.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveRef(ref.key)}
                className="ml-0.5 hover:text-destructive"
                title="移除引用"
                aria-label={`移除 ${ref.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 输入行 */}
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          title={projectId ? '引用项目上下文' : '需先选择项目'}
          disabled={disabled || !projectId}
          onClick={handleAtButton}
        >
          <AtSign className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? '请先选择或创建会话'
              : projectId
                ? '输入消息，@ 引用页面数据，Enter 发送...'
                : '输入消息，Enter 发送，Shift+Enter 换行...'
          }
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none min-h-[36px] max-h-[120px] py-2"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!text.trim() || sending || disabled}
          onClick={send}
          title="发送"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
