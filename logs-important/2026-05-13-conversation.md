# 2026-05-13 对话记录

## 主题：CreateProjectDialog 视觉还原 + 多环境部署架构设计 + E2E 原型校验机制

---

### 一、CreateProjectDialog 高保真原型视觉还原（主要工作）

**背景**：用户截图对比发现 CreateProjectDialog 实现与高保真原型存在明显视觉偏差，包括文案、布局、间距、按钮样式等多维度差异。

**根因分析**：
1. 开发者以 PRD 为参考源（PRD 写"编程标识符"/"确认创建按钮"），原型写"项目名称"/"确定"
2. 两份权威文档对同一元素给出不同定义，但流程中无交叉审查环节
3. UI 组件库（button/dialog/textarea）使用 shadcn 默认样式，未按原型 CSS 精确调校

**修复内容 — 8 处文案 + 12 处样式**：

#### 文案修改（CreateProjectDialog.tsx）
| # | 元素 | 修复前 | 修复后 |
|---|------|--------|--------|
| 1 | DialogDescription 副标题 | 有（"填写项目基本信息..."） | **删除** |
| 2 | 字段1 label | 项目标识符 | **项目名称** |
| 3 | 字段1 placeholder | 如 my-project | **如：ecommerce-admin** |
| 4 | 字段1 hint | 无 | **新增编程标识符提示** |
| 5 | 字段2 placeholder | 如 换电站管理系统 | **请输入项目显示名称** |
| 6 | 字段2 hint | 无 | **新增界面展示名称提示** |
| 7 | 字段3 label | 项目描述（可选） | **描述** |
| 8 | 字段3 placeholder | 简要描述这个项目... | **请输入项目描述（可选）** |
| 9 | 提交按钮 | 确认创建 | **确定** |

#### 样式修改（3 个组件文件）

**button.tsx**：
- Primary 变体加 `border-primary` 可见同色边框 + hover 同步变深
- 全局 size.default 字号 `text-sm`(14px) → `text-[13px]`（原型 .btn 规范）
- **关键修复**：所有 hover 规则的 `[a]:` 前缀移除 → 改为通用 `hover:`（`[a]:hover:` 只对 `<a>` 标签生效，Dialog 中按钮是 `<button>` 元素导致 hover 完全失效）

**dialog.tsx**：
- DialogHeader: `flex-col` → **`flex-row`**（原型 header 是左右排列）
- Footer: `gap-2`(8px) → **`gap-[10px]`**
- DialogContent: `grid gap-0` → **`flex flex-col`**
- 兜底 max-width: `calc(100%-2rem)` → **`90vw`**

**textarea.tsx**：
- 圆角 `rounded-lg`(8px) → **`rounded-input`(6px)
- 背景 `bg-transparent` → **`bg-card`**(实色底)
- 字号 → **`text-[13px]`**
- 移除 `py-2`、基类 `min-h-16`/`field-sizing-content`
- focus 样式对齐原型（primary 色 + 浅色光晕）

**CreateProjectDialog.tsx** 布局：
- Body 容器: `px-6 py-2` → **`p-6`**(四边统一24px，匹配原型 .dialog-body:padding:24px)
- 新增 **`overflow-y-auto`**
- 表单组间距: `space-y-4`(16px) → **`[&>div]:mb-[18px]`**
- Textarea 加 **`min-h-[80px]`**
- 取消按钮: `variant="outline"` → **`variant="soft"`**（hover 主色描边）

### 二、Step 2.5 PRD↔Prototype 一致性审查机制

**问题定位**：偏差发生在 Step 2（PRD）和原型设计之间，但 7 步流程中没有一步专门做这两份文档的交叉核对。

**产出物**：
- `CLAUDE.md` 新增 §Step 2.5 PRD↔原型一致性审查
- `docs/03-prd-ux/prd-convention.md` 新增 §4.4 UI 文案与原型一致性
- 裁决原则：用户看到的文字→以原型为准；内部字段名→以 PRD 为准

### 三、E2E 原型文案校验机制（防止遗漏到编码阶段）

**新建文件**：
- `packages/e2e/helpers/prototype-helpers.ts` — 合约提取 + 断言函数
  - `extractPrototypeDialogSpec()` 从 HTML 的 PROTOTYPE-CONTRACT 注释提取规格
  - `assertDialogMatchesPrototype()` 逐项断言 label/placeholder/hint/button
  - 修复了 4 个 bug: ESM 路径(fileURLToPath)、regex 缺少 `#`、title 截断(slice -1)、textarea 选择器
- `packages/e2e/tests/project-management/f-m1-02-create.spec.ts` — 2 个用例
- `packages/e2e/helpers/page-objects.ts` — 新增 CreateProjectDialogPO

**原型 HTML 追加契约注释** (`m1-project-list.html`)：
```html
<!--
  PROTOTYPE-CONTRACT:dialog#createDialog
  title=新建项目
  field:1|label=项目名称|required=true|placeholder=如：ecommerce-admin|hint=...
  ...
-->
```

### 四、多环境构建 + Docker Compose 部署架构设计

**触发原因**：用户新增 uat.json 环境，运行 restart-env.sh 后发现端口仍为 13181。

**根因链路**：
```
restart-env.sh export WEB_PORT=13381 → pnpm dev (turbo run dev)
→ Vite 加载根目录 .env (WEB_PORT=13181) → 覆盖 export 值
→ dev1 能工作纯属巧合（.env 值恰好和 dev1 一致）
```

**设计方案**（写入 `docs/07-deploy-design/multi-env-deploy.md`）：
- 每个环境 = 1 个 Docker Compose 项目（独立网络/端口/数据卷）
- nginx 容器作为单入口点（SPA 静态 + /api 反代到 api 容器）
- 两阶段 Docker 构建（node 编译 → nginx/node 运行）
- 配置注入三层模型：compose 覆写 → process.env → 应用消费
- 9 个新文件 + 4 个现有文件修改（仅输出设计文档，未执行代码修改）

**注意**：用户决定暂不执行部署架构的代码实现，只保留设计文档。

### 五、环境配置相关

- 新增 `environments/uat.json`（Web:13381 / API:13380 / DB:5435）
- `restart-env.sh` 尝试添加 export 环境变量（后被 Docker 方案替代）
- `vite.config.ts` 端口改为读 `process.env.WEB_PORT`

---

## 技术决策记录

1. **[a]:hover: vs hover:** Tailwind 的 `[a]:` 是子代选择器，只对 `<a>` 内部生效。Button 组件渲染为 `<button>` 时必须用通用 `hover:`。这是本次 hover 效果失效的根本原因。

2. **ESM module path resolution:** `__dirname` 在 ES module 中不可用。需用 `import { fileURLToPath } from 'node:url'` + `path.dirname(fileURLToPath(import.meta.url))`，且要从 helpers 目录向上 3 级才能到达项目根目录。

3. **PROTOTYPE-CONTRACT regex:** 必须在字符类中加入 `#`（`[\w-#]*`），因为 dialog ID 格式为 `dialog#createDialog`。

4. **Vite base:'./'**: 只影响 `vite build` 产物，dev server 忽略此配置用于 HMR。这对未来 nginx 部署至关重要。

## 下一步

- [ ] 执行多环境部署架构的代码实现（Dockerfile / compose / deploy.sh）
- [ ] 将其他 Dialog 组件（编辑、归档确认等）也做同样的视觉还原
- [ ] 考虑将 prototype-helpers.ts 泛化为通用工具（支持非 dialog 类型的页面级验证）
