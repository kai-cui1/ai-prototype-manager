/**
 * @module FieldConstraintsForm
 * @description 根据 fieldType 动态渲染字段约束配置表单。
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { FieldType } from '@/hooks/useDomainModel';

// R5 Why: @base-ui/react Input onChange e.target 类型为 HTMLElement，需断言取值
const iv = (e: React.ChangeEvent<HTMLElement>) => (e.target as HTMLInputElement).value;

interface EnumOption {
  value: string;
  label: string;
}

interface Props {
  fieldType: FieldType;
  constraints: Record<string, unknown>;
  onChange: (constraints: Record<string, unknown>) => void;
}

export default function FieldConstraintsForm({ fieldType, constraints, onChange }: Props) {
  const [enumOptions, setEnumOptions] = useState<EnumOption[]>(
    (constraints.options as EnumOption[]) ?? []
  );

  useEffect(() => {
    setEnumOptions((constraints.options as EnumOption[]) ?? []);
  }, [constraints.options]);

  const updateConstraint = (key: string, value: unknown) => {
    const next = { ...constraints };
    if (value === '' || value === undefined || value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  const addEnumOption = () => {
    const next = [...enumOptions, { value: '', label: '' }];
    setEnumOptions(next);
    onChange({ ...constraints, options: next });
  };

  const updateEnumOption = (idx: number, field: 'value' | 'label', val: string) => {
    const next = enumOptions.map((o, i) => (i === idx ? { ...o, [field]: val } : o));
    setEnumOptions(next);
    onChange({ ...constraints, options: next });
  };

  const removeEnumOption = (idx: number) => {
    const next = enumOptions.filter((_, i) => i !== idx);
    setEnumOptions(next);
    onChange({ ...constraints, options: next });
  };

  if (['boolean', 'email', 'url', 'phone'].includes(fieldType)) {
    return <p className="text-xs text-muted-foreground py-1">该字段类型无额外约束配置</p>;
  }

  if (fieldType === 'string') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">最小长度</Label>
            <Input
              type="number"
              min={0}
              value={(constraints.minLength as number) ?? ''}
              onChange={(e) => { const v = iv(e); updateConstraint('minLength', v ? Number(v) : ''); }}
              placeholder="不限"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">最大长度</Label>
            <Input
              type="number"
              min={1}
              value={(constraints.maxLength as number) ?? ''}
              onChange={(e) => { const v = iv(e); updateConstraint('maxLength', v ? Number(v) : ''); }}
              placeholder="不限"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">正则表达式（可选）</Label>
          <Input
            value={(constraints.pattern as string) ?? ''}
            onChange={(e) => updateConstraint('pattern', iv(e))}
            placeholder="如 ^[A-Z].*"
            className="h-8 text-sm font-mono"
          />
        </div>
      </div>
    );
  }

  if (fieldType === 'number') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">最小值</Label>
            <Input
              type="number"
              value={(constraints.min as number) ?? ''}
              onChange={(e) => { const v = iv(e); updateConstraint('min', v ? Number(v) : ''); }}
              placeholder="不限"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">最大值</Label>
            <Input
              type="number"
              value={(constraints.max as number) ?? ''}
              onChange={(e) => { const v = iv(e); updateConstraint('max', v ? Number(v) : ''); }}
              placeholder="不限"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">精度（小数位数）</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={(constraints.precision as number) ?? ''}
            onChange={(e) => { const v = iv(e); updateConstraint('precision', v ? Number(v) : ''); }}
            placeholder="不限"
            className="h-8 text-sm"
          />
        </div>
      </div>
    );
  }

  if (fieldType === 'datetime') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">日期格式</Label>
        <Select
          value={(constraints.format as string) ?? 'datetime'}
          onValueChange={(val) => updateConstraint('format', val ?? 'datetime')}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="datetime" className="text-sm">日期时间（datetime）</SelectItem>
            <SelectItem value="date" className="text-sm">仅日期（date）</SelectItem>
            <SelectItem value="time" className="text-sm">仅时间（time）</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (fieldType === 'text') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">最大长度</Label>
        <Input
          type="number"
          min={1}
          value={(constraints.maxLength as number) ?? ''}
          onChange={(e) => { const v = iv(e); updateConstraint('maxLength', v ? Number(v) : ''); }}
          placeholder="不限"
          className="h-8 text-sm"
        />
      </div>
    );
  }

  if (fieldType === 'enum') {
    return (
      <div className="space-y-2">
        <Label className="text-xs">
          枚举选项 <span className="text-red-500">*</span>
          <span className="ml-1 text-muted-foreground font-normal">（至少 1 个）</span>
        </Label>
        {enumOptions.length === 0 && (
          <p className="text-xs text-red-500">枚举类型至少需要一个选项</p>
        )}
        <div className="space-y-1.5">
          {enumOptions.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Input
                value={opt.value}
                onChange={(e) => updateEnumOption(idx, 'value', iv(e))}
                placeholder="值（如 active）"
                className="h-7 text-xs font-mono flex-1"
              />
              <Input
                value={opt.label}
                onChange={(e) => updateEnumOption(idx, 'label', iv(e))}
                placeholder="标签（如 激活）"
                className="h-7 text-xs flex-1"
              />
              <button
                onClick={() => removeEnumOption(idx)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs border-dashed"
          onClick={addEnumOption}
        >
          <Plus className="h-3 w-3" />
          添加选项
        </Button>
      </div>
    );
  }

  return null;
}
