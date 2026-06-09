/**
 * @module DomainModelEditor
 * @description 领域模型编辑器根组件：布局容器，包含 Toolbar + Toolbox + Canvas/List + Inspector。
 *
 * 布局：
 *   ┌──────────────────────────────────────────────┐
 *   │ Toolbar (48px)                               │
 *   │ Toolbox (36px, 可折叠, 仅 ER 图模式)          │
 *   ├──────────────────────┬───────────────────────┤
 *   │ Canvas / ListView    │ Inspector (0 or 360px)│
 *   └──────────────────────┴───────────────────────┘
 */

import { useDomainModelContext } from '@/contexts/DomainModelContext';
import Toolbar from './Toolbar';
import Toolbox from './canvas/Toolbox';
import ERCanvas from './canvas/ERCanvas';
import EntityListView from './list/EntityListView';
import Inspector from './inspector/Inspector';

export default function DomainModelEditor() {
  const { viewMode } = useDomainModelContext();

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <Toolbar />

      {/* 工具箱（仅 ER 图模式显示） */}
      {viewMode === 'graph' && <Toolbox />}

      {/* 内容区：画布 / 列表 + Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* 主内容区 */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'graph' ? <ERCanvas /> : <EntityListView />}
        </div>

        {/* Inspector 右滑面板 */}
        <Inspector />
      </div>
    </div>
  );
}
