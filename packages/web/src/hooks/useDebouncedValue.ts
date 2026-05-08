/**
 * @module useDebouncedValue
 * @description 防抖 Hook：延迟更新值，适用于搜索输入等场景。
 */
import { useEffect, useState } from 'react';

/**
 * 防抖 Hook：延迟更新值，适用于搜索输入等场景。
 *
 * @param value - 原始输入值
 * @param delay - 防抖延迟（毫秒），默认 300ms
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
