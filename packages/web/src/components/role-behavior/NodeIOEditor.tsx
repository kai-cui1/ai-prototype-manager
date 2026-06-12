/**
 * @module NodeIOEditor
 * @description NodeIO 参数行编辑器 — Action inputs/outputs 和 Decision 分支 outputs 共用。
 *
 * S3 交互设计规格: project-management-interaction.md §11.6
 * 暴露 name/type/required/description/defaultValue（仅输入参数），constraints 保留在 JSONB 不在 UI 暴露。
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { NodeIO } from '@apm/shared';

// ============================================================
// Types
// ============================================================

export interface NodeIOItem {
  name: string;
  type: string;
  required: boolean;
  description: string;
  /** 默认值（字符串形式，API 层存储为 JSONB） */
  defaultValue: string;
}

export interface NodeIOEditorProps {
  /** 区块标题，如 "输入参数" 或 "输出参数" */
  label: string;
  /** 参数列表 */
  items: NodeIOItem[];
  /** 更新回调 */
  onChange: (items: NodeIOItem[]) => void;
  /** 是否显示 required 列（outputs 通常不显示 required） */
  showRequired?: boolean;
  /** 是否显示 defaultValue 列（仅输入参数显示） */
  showDefaultValue?: boolean;
  /** 校验错误：key 为 "index-field" 格式，如 "0-name" */
  errors?: Record<string, string>;
  /** 是否禁用 */
  disabled?: boolean;
}

// ============================================================
// Constants
// ============================================================

/** S3 §11.6 — type 下拉选项 */
const TYPE_OPTIONS = [
  'string',
  'number',
  'boolean',
  'datetime',
  'text',
  'enum',
  'email',
  'url',
  'phone',
  'object',
  'array',
] as const;

/** 创建空参数行（type 默认 object，方便人工快速创建） */
function blankItem(): NodeIOItem {
  return { name: '', type: 'object', required: false, description: '', defaultValue: '' };
}

// ============================================================
// Component
// ============================================================

export function NodeIOEditor({
  label,
  items,
  onChange,
  showRequired = true,
  showDefaultValue = false,
  errors = {},
  disabled = false,
}: NodeIOEditorProps) {
  const updateItem = (index: number, field: keyof NodeIOItem, value: string | boolean) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, blankItem()]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* 区域标题 + 添加按钮 */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          ── {label} ──
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-primary hover:text-primary"
          onClick={addItem}
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" /> 添加参数
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-text-tertiary py-2 text-center">
          暂无参数，点击「添加参数」创建
        </p>
      )}

      {/* 参数行列表 */}
      {items.map((item, index) => {
        const nameError = errors[`${index}-name`];
        const typeError = errors[`${index}-type`];

        return (
          <div
            key={index}
            className="rounded border border-card-border bg-muted/30 p-2.5 space-y-1.5"
          >
            {/* 第一行：name + type + required */}
            <div className="flex items-center gap-2">
              <div className="flex-[2]">
                <Input
                  placeholder="参数名 *"
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', (e.target as HTMLInputElement).value)}
                  disabled={disabled}
                  className={`h-7 text-sm ${nameError ? 'border-danger focus-visible:ring-danger/30' : ''}`}
                />
              </div>
              <div className="w-[130px] shrink-0">
                <Select
                  value={item.type || undefined}
                  onValueChange={(val) => updateItem(index, 'type', val ?? '')}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`h-7 text-sm ${typeError ? 'border-danger' : ''}`}
                  >
                    <SelectValue placeholder="类型 *" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showRequired && (
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
                  <Checkbox
                    checked={item.required}
                    onCheckedChange={(checked) =>
                      updateItem(index, 'required', checked === true)
                    }
                    disabled={disabled}
                    className="size-3.5"
                  />
                  <span className="text-xs text-text-secondary">必填</span>
                </label>
              )}
              {/* 删除按钮 */}
              <button
                type="button"
                className="p-1 ml-auto shrink-0 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                onClick={() => removeItem(index)}
                disabled={disabled}
                title="删除此参数"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 错误提示 */}
            {(nameError || typeError) && (
              <div className="flex gap-2">
                {nameError && <p className="text-[11px] text-danger flex-[2]">{nameError}</p>}
                {typeError && <p className="text-[11px] text-danger w-[130px]">{typeError}</p>}
              </div>
            )}

            {/* 第二行：description + defaultValue */}
            <div className="flex items-center gap-2">
              <div className="flex-[2]">
                <Input
                  placeholder="参数描述（可选）"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', (e.target as HTMLInputElement).value)}
                  disabled={disabled}
                  className="h-7 text-sm"
                />
              </div>
              {showDefaultValue ? (
                <div className="flex-1">
                  {item.type === 'boolean' ? (
                    <label className="flex items-center gap-1.5 h-7 cursor-pointer select-none">
                      <Checkbox
                        checked={item.defaultValue === 'true'}
                        onCheckedChange={(checked) =>
                          updateItem(index, 'defaultValue', checked ? 'true' : 'false')
                        }
                        disabled={disabled}
                        className="size-3.5"
                      />
                      <span className="text-xs text-text-secondary">默认值</span>
                    </label>
                  ) : (
                    <Input
                      placeholder="默认值（可选）"
                      value={item.defaultValue}
                      onChange={(e) => updateItem(index, 'defaultValue', (e.target as HTMLInputElement).value)}
                      disabled={disabled}
                      type={item.type === 'number' ? 'number' : 'text'}
                      className="h-7 text-sm"
                    />
                  )}
                </div>
              ) : (
                <div className="w-[130px] shrink-0" />
              )}
              {showRequired && <div className="w-[52px] shrink-0" />}
              <div className="w-[28px] shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

/** 将 NodeIO[] 转为编辑器内部格式 NodeIOItem[] */
export function toNodeIOItems(items: NodeIO[] | undefined): NodeIOItem[] {
  if (!items) return [];
  return items.map((item) => ({
    name: item.name,
    type: item.type,
    required: item.required ?? false,
    description: item.description ?? '',
    defaultValue: item.defaultValue != null ? String(item.defaultValue) : '',
  }));
}

/** 将编辑器内部格式 NodeIOItem[] 转为 API 提交格式 NodeIO[] */
export function fromNodeIOItems(items: NodeIOItem[]): NodeIO[] {
  return items.map((item) => {
    const result: NodeIO = {
      name: item.name,
      type: item.type,
      required: item.required,
    };
    if (item.description) {
      result.description = item.description;
    }
    if (item.defaultValue) {
      // 尝试解析为 JSON 值（number/boolean/object），否则保留为 string
      try {
        const parsed = JSON.parse(item.defaultValue);
        result.defaultValue = parsed;
      } catch {
        result.defaultValue = item.defaultValue;
      }
    }
    return result;
  });
}

/** 校验参数行，返回错误 map */
export function validateNodeIOItems(items: NodeIOItem[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameSet = new Set<string>();

  items.forEach((item, index) => {
    if (!item.name) {
      errors[`${index}-name`] = '参数名不能为空';
    } else if (item.name.length > 50) {
      errors[`${index}-name`] = '参数名不超过 50 字符';
    } else if (nameSet.has(item.name)) {
      errors[`${index}-name`] = `参数名 "${item.name}" 重复`;
    } else {
      nameSet.add(item.name);
    }

    if (!item.type) {
      errors[`${index}-type`] = '请选择类型';
    }
  });

  return errors;
}