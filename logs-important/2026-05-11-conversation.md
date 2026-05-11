# 2026-05-11 会话记录

## 会话概要

**主题**：M1 UI 差异分析 + A组（Header Bar + Sidebar）实施 + 端口统一配置

---

## 一、M1 前端实现 vs 高保真原型差异分析

### 背景
M1 Step 5 编码完成后，通过 Playwright 实际运行检测前端 UI，对比高保真 HTML 原型和 E2E 测试设计文档，发现显著差距。

### 检测方式
- Playwright (Chromium headless, 1280x720) 实际访问 localhost
- 截图 14 张 + DOM 结构分析 + 控制台错误捕获
- 对照基准：HTML 高保真原型 (`docs/03-prd-ux/prototypes/`) + E2E 测试设计 (`docs/06-test-design/modules/project-management/`)

### 发现的问题
| 严重度 | 数量 | 关键问题 |
|--------|:----:|----------|
| P0 阻塞性 | 6 | 无 Header Bar、Sidebar 样式严重偏差(白底vs深色)、详情页缺归档按钮、公司展示形式错误(卡片vs表格)、部门无树形组件、OrganizationPanel 嵌套 Tab 结构错误 |
| P1 功能缺失 | 11 | 缺 version 字段、缺领域模型/业务流程 Tab、Summary 卡片粒度过细、各组织架构缺编辑功能、列表页缺排序/完整分页等 |
| P2 体验优化 | 5 | Dark mode 无切换 UI、对话框宽度未固定等 |

### 产出
- **报告**: `docs/20-analyze-report/m1-ui-gap-analysis-2026-05-11.md`
- **E2E 检查脚本**: `packages/e2e/inspect-ui.mjs`
- **截图**: `packages/e2e/inspection-screenshots/` (14 张 PNG + JSON 报告)

---

## 二、A 组实施：Header Bar + Sidebar 样式重构

### 变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `packages/web/src/hooks/useThemeToggle.ts` | 主题切换 Hook（.dark 类 + localStorage） |
| 新建 | `packages/web/src/components/layout/HeaderBar.tsx` | 顶部导航栏（面包屑 + 主题切换 + 通知铃铛 + 用户名） |
| 新建 | `packages/web/src/components/layout/Sidebar.tsx` | 从 Layout.tsx 提取并重构 |
| 重写 | `packages/web/src/components/Layout.tsx` | 三栏布局：Sidebar → HeaderBar + main |
| 修改 | `packages/web/src/index.css` | 补充 --sidebar-* CSS 变量（8 个） |

### Sidebar 关键变更
- 背景白底 → 深色 #001529（Ant Design Pro 风格，固定暗色）
- 宽度 256px → 220px
- 图标 unicode ● → lucide-react 真图标 (Folder / Settings / ListTree)
- 新增分组标签（directory 菜单上方大写标签）
- 激活项 bg-accent → bg-[#08979c]（teal 主色）
- 折叠箭头 ←/→ → ◀/▶
- 版本号 APM v0.1 → APM v0.1.0

### HeaderBar 关键特性
- 高度 48px，位于 sidebar 和内容区之间
- 左侧：面包屑导航（根据路由自动生成）
- 右侧：主题切换按钮 + 通知铃铛 + 用户名

---

## 三、端口统一配置

### 问题发现
- 项目有 3 个冗余 Vite 实例同时运行（5174/5175/5176）
- API 端口 3000 与其他项目冲突
- 前端 axios client fallback 硬编码 localhost:3000，未随新端口更新
- 环境参数散落在多处硬编码

### 解决方案

**统一配置源 — `.env`（根目录唯一）**：

| 变量 | 旧值 | 新值 | 用途 |
|------|------|------|------|
| API_PORT | 3000 | 13180 | 后端端口 |
| WEB_PORT | 5173 | 13181 | 前端 Vite 端口 |
| VITE_API_BASE_URL | *(无)* | 空 | 前端 API 地址（空=走 Vite proxy） |

### 修改的文件
- `.env` — 端口更新 + 新增 VITE_API_BASE_URL + 配置说明注释
- `workspace/dev/.env.example` — 同步更新
- `packages/api/src/app.ts` — 默认端口 3000 → 读 API_PORT || 13180
- `packages/web/vite.config.ts` — 端口 5173→13180，proxy target→localhost:13180
- `packages/web/src/lib/api-client.ts` — fallback 从硬编码 localhost:3000 → 读 VITE_API_BASE_URL ?? ''
- `packages/e2e/inspect-ui.mjs` — 硬编码端口 → 读 process.env.API_PORT / WEB_PORT

### 设计原则
- 开发环境：前端通过 Vite proxy 转发 `/api` 到后端，浏览器端代码不含任何硬编码地址
- 生产环境：在 .env 设置 VITE_API_BASE_URL=实际地址 即可
- 所有环境参数集中在根目录 .env，禁止代码中硬编码

---

## 四、待继续工作

A 组已完成，后续按优先级依次处理：
- **B 组**：详情页结构修复（归档按钮、Tab 调整、version 字段、Summary 3卡片）
- **C 组**：列表页优化（表格列调整、操作列文字链接、排序 UI、分页完善）
- **D 组**：组织架构子模块（公司表格化、部门树形组件、去嵌套 Tab）
