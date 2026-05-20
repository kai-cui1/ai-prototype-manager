# Rebase feature/phase1 onto latest origin/main — 执行计划

> **日期**：2026-04-30
> **状态**：待执行
> **背景**：GitHub 显示 feature/phase1 behind main 5 commits（来自 PR #1 process-design 合入）

---

## Context

GitHub 显示 `feature/phase1` is **21 commits ahead of** and **5 commits behind** `main`。
这 5 个 behind 的提交来自 `feature/process-design` 分支通过 PR #1 合入远程 main。
需要将 `feature/phase1` 变基到最新 `origin/main`，确保后续合并无冲突。

---

## 冲突分析

### 根本原因

`origin/main`（来自 process-design PR）的文件状态**比 feature/phase1 更旧**。
两个分支对同一批文件做了方向相反的修改：

| 文件 | feature/phase1（我们的） | origin/main（远程的） | 冲突类型 |
|------|------------------------|---------------------|----------|
| `CLAUDE.md` | 新增「产品目标 + 7步工作规范」，删除旧的「协作模式」图 | 恢复旧的「协作模式」图，删除 7 步规范 | **内容冲突 — 需手动合入** |
| `package.json` | 创建/修改（含 test:e2e script） | **删除**该文件 | **方向相反 — 保留 ours** |
| `pnpm-workspace.yaml` | 创建（含 validation-schemas） | **删除** | **方向相反 — 保留 ours** |
| `docs/00-project/roadmap.md` | 创建 V4 路线图（448 行） | **删除** | **方向相反 — 保留 ours** |
| `packages/*` 全部代码 | 新建 monorepo 结构 | 大部分是旧版本或不存在 | **保留 ours** |

### 结论：78 个共同修改文件中，绝大多数应保留 `feature/phase1` 的版本

因为 origin/main 的这些文件来自更早的时间点，phase1 的版本更新更完整。

---

## 执行步骤

### Step 1: 备份当前分支状态

```bash
git branch backup/phase1-before-rebase HEAD
```

### Step 2: 拉取最新远程 main

```bash
git fetch origin
```

### Step 3: 执行 rebase

```bash
git rebase origin/main
```

预计会有冲突，按以下策略逐个解决：

#### 冲突解决规则

| 文件/类别 | 策略 | 原因 |
|-----------|------|------|
| `CLAUDE.md` | **合入两边** — 以 phase1 版本为基础，检查 main 是否有独有内容需补充 | 两边都有有价值的改动 |
| `package.json` | **保留 phase1（ours）** | main 删除了它，但我们需要这个文件 |
| `pnpm-workspace.yaml` | **保留 phase1（ours）** | 同上 |
| `docs/00-project/roadmap.md` | **保留 phase1（ours）** | V4 是最新版，main 的版本更旧 |
| `packages/**` 所有代码 | **保留 phase1（ours）** | 我们的新建代码 |
| `.gitignore` | **合入两边** | 可能各有新增忽略规则 |
| `pnpm-lock.yaml` | **保留 phase1 后重新生成** | lockfile 不适合手动合并 |
| 其他 docs 文件 | **保留 phase1（ours）** | 我们的文档体系更完整 |

### Step 4: 解决冲突后继续 rebase

```bash
git add <resolved files>
git rebase --continue
# 重复直到所有 commit rebase 完成
```

### Step 5: 验证

```bash
git log --oneline -5              # 确认 21 个 commit 都在
git status                        # 确认 clean
git diff origin/main...HEAD --stat # 确认 ahead 数量正确
pnpm install                       # 验证依赖正常
pnpm dev                           # 验证项目能启动
```

### Step 6: （可选）强制推送

如果确认无误：

```bash
git push --force-with-lease origin feature/phase1
```

---

## 风险提示

- **rebase 会改写历史** — 如果有人基于当前的 feature/phase1 做了工作，需要通知他们
- 当前只有你一个人在 `feature/phase1` 上工作，风险极低
- 已创建 `backup/phase1-before-rebase` 分支作为安全网
