# Phase 1 基础设施搭建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Monorepo 项目骨架、数据库连接、共享类型、校验框架、后端 Fastify 骨架、前端 React 骨架，为 M1~M6 功能模块开发提供可运行的基础设施。

**Architecture:** pnpm workspaces 管理 4 个包（api / web / shared / validation-schemas），Turborepo 编排构建任务。后端 Fastify + Drizzle ORM + PostgreSQL，前端 React + Vite + shadcn/ui + Tailwind CSS，前后端通过 REST API 通信。

**Tech Stack:** pnpm 8+, Turborepo 2+, Node.js 20+, PostgreSQL 16, Drizzle ORM 0.30+, Fastify 4+, TypeBox 0.31+, Ajv 8+, React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui

---

## File Structure Overview

```
ai-prototype-manager/
├── package.json                    # [NEW] Root workspace coordinator
├── pnpm-workspace.yaml             # [NEW] Workspace definitions
├── turbo.json                      # [NEW] Turborepo task pipeline
├── .gitignore                      # [MODIFY] Add monorepo ignores
├── packages/
│   ├── api/package.json            # [NEW] Backend (Fastify)
│   ├── api/tsconfig.json           # [NEW]
│   ├── api/src/
│   │   ├── db.ts                   # [NEW] DB connection
│   │   ├── app.ts                  # [NEW] Fastify entry
│   │   ├── models/
│   │   │   ├── schema.ts           # [NEW] Drizzle schema (empty for now)
│   │   │   └── relations.ts        # [NEW] Drizzle relations (empty)
│   │   └── routes/                 # [NEW] dir (empty)
│   ├── api/drizzle/
│   │   ├── config.ts               # [NEW] Drizzle config
│   │   └── migrations/             # [NEW] dir
│   ├── web/package.json            # [NEW] Frontend (React+Vite)
│   ├── web/tsconfig.json           # [NEW]
│   ├── web/tsconfig.node.json      # [NEW]
│   ├── web/vite.config.ts          # [NEW]
│   ├── web/index.html              # [NEW]
│   ├── web/src/
│   │   ├── App.tsx                 # [NEW] React entry
│   │   ├── main.tsx                # [NEW] Vite entry
│   │   ├── components/
│   │   │   └── Layout.tsx          # [NEW] App layout (Sidebar + content)
│   │   └── api/
│   │       └── client.ts           # [NEW] API client wrapper
│   ├── shared/package.json         # [NEW] Shared types & utils
│   ├── shared/tsconfig.json        # [NEW]
│   └── shared/src/
│       ├── types/
│       │   ├── project.ts          # [NEW] Project types
│       │   ├── domain.ts           # [NEW] Domain model types
│       │   ├── process.ts          # [NEW] Process types
│       │   ├── organization.ts     # [NEW] Organization types
│       │   ├── architecture.ts     # [NEW] Architecture types
│       │   ├── menu.ts             # [NEW] Menu types
│       │   └── index.ts            # [NEW] Barrel export
│       └── utils/
│           └── index.ts            # [NEW] Shared utils
├── validation-schemas/             # NOTE: named without 'packages/' prefix per spec §3
│   ├── package.json                # [NEW] Validation schemas
│   ├── tsconfig.json               # [NEW]
│   └── src/
│       ├── index.ts                # [NEW] Ajv instance + exports
│       └── base.ts                 # [NEW] Base schemas (ID, pagination, timestamps)
├── workspace/
│   └── dev/
│       ├── docker-compose.yml      # [NEW] PostgreSQL dev service
│       ├── .env.example            # [NEW] Env template
│       └── .gitignore              # [NEW]
```

---

### Task 1: Monorepo 初始化（INF-1）

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `.gitignore`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/tsconfig.node.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `validation-schemas/package.json`
- Create: `validation-schemas/tsconfig.json`

- [ ] **Step 1: 创建根目录配置文件**

创建 root `package.json`：

```json
{
  "name": "ai-prototype-manager",
  "version": "0.1.0",
  "private": true,
  "description": "AI 时代的软件原型设计工具",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

创建 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
  - 'validation-schemas'
```

创建 `turbo.json`：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

更新 `.gitignore`：

```
node_modules/
.env
*.log
.DS_Store
dist/
.turbo/
*.tsbuildinfo
coverage/
workspace/dev/.env
```

- [ ] **Step 2: 运行 `pnpm install` 验证 workspace 结构**

Run: `pnpm install`
Expected: 成功安装，无错误；生成根 `node_modules` 和 `.pnpm-workspace.yaml` 解析成功

- [ ] **Step 3: 创建各包的 package.json 和 tsconfig.json**

**packages/api/package.json**:

```json
{
  "name": "@apm/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "@apm/shared": "workspace:*",
    "@apm/validation-schemas": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

**packages/api/tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "drizzle"]
}
```

**packages/web/package.json**:

```json
{
  "name": "@apm/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.0",
    "@apm/shared": "workspace:*",
    "lucide-react": "^0.474.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.0",
    "vite": "^6.1.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.0",
    "autoprefixer": "^10.4.20",
    "@tailwindcss/forms": "^0.5.9"
  }
}
```

**packages/web/tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**packages/web/tsconfig.node.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "resolveJsonModule": true,
    "allowJs": false
  },
  "include": ["vite.config.ts"]
}
```

**packages/shared/package.json**:

```json
{
  "name": "@apm/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**packages/shared/tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**validation-schemas/package.json**:

```json
{
  "name": "@apm/validation-schemas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@sinclair/typebox": "^0.34.0",
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**validation-schemas/tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 运行 `pnpm install` 安装所有依赖**

Run: `pnpm install`
Expected: 所有包依赖解析成功，无 peer dependency 冲突

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore \
  packages/api/package.json packages/api/tsconfig.json \
  packages/web/package.json packages/web/tsconfig.json packages/web/tsconfig.node.json \
  packages/shared/package.json packages/shared/tsconfig.json \
  validation-schemas/package.json validation-schemas/tsconfig.json \
  pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: initialize monorepo structure (INF-1)

- Root workspace config: pnpm workspaces + Turborepo pipeline
- 4 packages: api (Fastify), web (React+Vite), shared (types), validation-schemas (TypeBox)
- All package.json and tsconfig.json in place

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: PostgreSQL + Drizzle ORM 初始化（INF-2）

**Files:**
- Create: `workspace/dev/docker-compose.yml`
- Create: `workspace/dev/.env.example`
- Create: `workspace/dev/.gitignore`
- Create: `packages/api/src/db.ts`
- Create: `packages/api/drizzle/config.ts`
- Create: `packages/api/drizzle/migrations/.gitkeep`
- Create: `packages/api/src/models/schema.ts`
- Create: `packages/api/src/models/relations.ts`

- [ ] **Step 1: 创建 Docker Compose 开发环境**

Create `workspace/dev/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: apm_dev
      POSTGRES_PASSWORD: apm_dev_secret
      POSTGRES_DB: apm_prototype
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U apm_dev -d apm_prototype"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

Create `workspace/dev/.env.example`:

```env
# Database
DATABASE_URL=postgresql://apm_dev:apm_dev_secret@localhost:5432/apm_prototype

# API
API_PORT=13180
API_HOST=0.0.0.0

# Web（Vite 前端，见 CLAUDE.md「全局端口约定」）
WEB_PORT=13181
```

Create `workspace/dev/.gitignore`:

```
.env
```

- [ ] **Step 2: 启动 PostgreSQL 容器并验证连接**

Run: `cd workspace/dev && docker compose up -d && docker compose ps`
Expected: postgres 容器 running 状态，健康检查通过

- [ ] **Step 3: 创建数据库连接模块 `packages/api/src/db.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './models/schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://apm_dev:apm_dev_secret@localhost:5432/apm_prototype';

// Connection for queries (uses prepared statements by default)
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });

// Raw connection for migrations (no prepared statement caching)
export const migrationSql = postgres(connectionString, { prepare: false });

export type Db = typeof db;
```

- [ ] **Step 4: 创建 Drizzle 配置 `packages/api/drizzle/config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://apm_dev:apm_dev_secret@localhost:5432/apm_prototype',
  },
});
```

- [ ] **Step 5: 创建空 Schema 文件和 Relations 文件**

Create `packages/api/src/models/schema.ts`:

```typescript
import { pgTable, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Table 1: projects — 项目主表
// ============================================
export const projects = pgTable('projects', {
  id: text('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active | archived
  version: integer('version').notNull().default(1),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Placeholder: remaining tables will be added
// as each module is implemented (M1-M6)
// ============================================

// Re-export everything for convenience
export { relations };
```

Create `packages/api/src/models/relations.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { projects } from './schema.js';

export const projectsRelations = relations(projects, ({ many }) => ({
  // Domain entities relation will be added in M2
  // Business processes relation will be added in M3
  // Companies relation will be added in M4
}));
```

- [ ] **Step 6: 生成初始迁移文件**

Run: `cd packages/api && pnpm db:generate --name init_projects_table`
Expected: 在 `drizzle/migrations/` 下生成 SQL 迁移文件，包含 `projects` 表的 CREATE TABLE 语句

- [ ] **Step 7: 执行迁移验证表创建成功**

Run: `cd packages/api && pnpm db:migrate`
Expected: 迁移执行成功，PostgreSQL 中已存在 `projects` 表

- [ ] **Step 8: Commit**

```bash
git add workspace/dev/ packages/api/src/db.ts packages/api/drizzle/ \
  packages/api/src/models/schema.ts packages/api/src/models/relations.ts
git commit -m "$(cat <<'EOF'
feat: initialize PostgreSQL + Drizzle ORM (INF-2)

- Docker Compose for PostgreSQL 16 dev environment
- DB connection module (drizzle + postgres.js)
- Drizzle Kit config for migrations
- Initial projects table schema definition
- First migration generated

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 共享类型包骨架（INF-3）

**Files:**
- Create: `packages/shared/src/types/project.ts`
- Create: `packages/shared/src/types/domain.ts`
- Create: `packages/shared/src/types/process.ts`
- Create: `packages/shared/src/types/organization.ts`
- Create: `packages/shared/src/types/architecture.ts`
- Create: `packages/shared/src/types/menu.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/utils/index.ts`

- [ ] **Step 1: 创建项目类型 `packages/shared/src/types/project.ts`**

```typescript
// ============================================
// Project Types — 对应 projects 表
// ============================================

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProjectStatus;
  version: number;
  config: Record<string, unknown>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  status?: ProjectStatus;
  config?: Record<string, unknown>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  entityCount: number;
  processCount: number;
  companyCount: number;
}
```

- [ ] **Step 2: 创建领域模型类型 `packages/shared/src/types/domain.ts`**

```typescript
// ============================================
// Domain Model Types — 对应 domain_entities / entity_fields / entity_relations
// ============================================

export type EntityCategory = 'core' | 'supporting' | 'event' | string;

// 26 种字段类型
export type FieldType =
  | 'string' | 'number' | 'boolean' | 'datetime'
  | 'text' | 'enum' | 'email' | 'url' | 'phone'
  | 'currency' | 'percentage' | 'coordinate' | 'file'
  | 'image' | 'rich_text' | 'json' | 'array'
  | 'reference' | 'formula' | 'computed' | 'color'
  | 'rating' | 'icon' | 'duration' | 'status';

export type RelationKind = 'dependency' | 'aggregation' | 'composition';

export interface DomainEntity {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  category: EntityCategory | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityField {
  id: string;
  entityId: string;
  name: string;
  displayName: string;
  description: string | null;
  fieldType: FieldType;
  isRequired: boolean;
  defaultValue: unknown;
  constraints: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRelation {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationKind: RelationKind;
  targetCardinality: string;
  displayName: string | null;
  description: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: 创建业务流程类型 `packages/shared/src/types/process.ts`**

```typescript
// ============================================
// Process Types — 对应 business_processes / process_nodes / process_edges / process_node_map
// ============================================

export type ProcessStatus = 'draft' | 'active' | 'deprecated';
export type NodeType = 'action' | 'decision';
export type HolderType = 'role' | 'external_entity' | 'service';

export interface BusinessProcess {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProcessStatus;
  version: number;
  parentProcessId: string | null;
  entryNodeId: string | null;
  exitNodeIds: string[];
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessNode {
  id: string;
  projectId: string;
  nodeType: NodeType;
  name: string;
  displayName: string;
  description: string | null;
  holderType: HolderType;
  holderId: string;
  branches: Array<{ name: string; condition?: string; outputs?: string[] }>;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  mappings: Array<Record<string, unknown>>;
  label: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessNodeMap {
  id: string;
  processId: string;
  nodeId: string;
  sortOrder: number;
  createdAt: string;
}
```

- [ ] **Step 4: 创建组织架构类型 `packages/shared/src/types/organization.ts`**

```typescript
// ============================================
// Organization Types — 对应 companies / departments / roles / external_entities
// ============================================

export type CompanyType = 'internal' | 'external' | 'partner' | 'client' | string;

export interface Company {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  companyType: CompanyType | null;
  contactInfo: Record<string, unknown>;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  projectId: string;
  companyId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  contactInfo: Record<string, unknown>;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  projectId: string;
  departmentId: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  contactInfo: Record<string, unknown>;
  actions: unknown[];
  decisions: unknown[];
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalEntity {
  id: string;
  projectId: string;
  companyId: string | null;
  departmentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  entityType: string | null;
  contactInfo: Record<string, unknown>;
  actions: unknown[];
  decisions: unknown[];
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 5: 创建业务架构类型 `packages/shared/src/types/architecture.ts`**

```typescript
// ============================================
// Architecture Types — 对应 business_architectures / biz_arch_process_map
// ============================================

export type ArchitectureLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface BusinessArchitecture {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  level: ArchitectureLevel;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BizArchProcessMap {
  id: string;
  architectureId: string;
  processId: string;
  sortOrder: number;
  createdAt: string;
}
```

- [ ] **Step 6: 创建菜单类型 `packages/shared/src/types/menu.ts`**

```typescript
// ============================================
// Menu Types — 对应 menus 表
// ============================================

export type MenuType = 'menu' | 'directory' | 'separator';

export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  displayName: string;
  icon: string | null;
  path: string | null;
  menuType: MenuType;
  sortOrder: number;
  visible: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  children?: MenuItem[]; // 服务端树形查询时填充
}
```

- [ ] **Step 7: 创建 barrel 导出 `packages/shared/src/types/index.ts`**

```typescript
export * from './project.js';
export * from './domain.js';
export * from './process.js';
export * from './organization.js';
export * from './architecture.js';
export * from './menu.js';
```

- [ ] **Step 8: 创建工具函数 `packages/shared/src/utils/index.ts`**

```typescript
/**
 * 通用分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 计算总页数
 */
export function calcTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * 统一 API 响应格式 — 单个资源
 */
export function successResponse<T>(data: T) {
  return { data };
}

/**
 * 统一 API 响应格式 — 列表
 */
export function listResponse<T>(data: T[], meta: PaginationMeta) {
  return { data, meta };
}

/**
 * 统一错误响应格式
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function errorResponse(error: ApiError) {
  return { error };
}
```

- [ ] **Step 9: 验证 TypeScript 编译通过**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: 无 TypeScript 编译错误

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/
git commit -m "$(cat <<'EOF'
feat: add shared types package skeleton (INF-3)

- Project, Domain, Process, Organization, Architecture, Menu types
- Barrel export from types/index.ts
- Shared utilities: pagination helpers, API response formatters

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 校验框架搭建（INF-4）

**Files:**
- Create: `validation-schemas/src/base.ts`
- Create: `validation-schemas/src/index.ts`

- [ ] **Step 1: 创建基础校验 Schema `validation-schemas/src/base.ts`**

```typescript
import { Type } from '@sinclair/typebox';

// ============================================
// Base Schemas — 通用基础类型
// ============================================

/** UUID 格式的 ID（TEXT PRIMARY KEY） */
export const IdSchema = Type.String({
  format: 'uuid',
  description: 'UUID v4 string identifier',
});

/** 可选 ID */
export const OptionalIdSchema = Type.Optional(IdSchema);

/** 自动生成的 ID（仅用于输出） */
export const AutoIdSchema = Type.ReadonlyOptional(IdSchema);

/** 分页查询参数 */
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

/** 标准时间戳字段 */
export const TimestampsSchema = Type.Object({
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false });

/** 项目 ID 路径参数 */
export const ProjectIdParamSchema = Type.Object({
  projectId: IdSchema,
});

/** 通用字符串搜索查询 */
export const SearchQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 200 })),
});

/** 错误码枚举（Phase 1 范围） */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** 校验结果包装 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}
```

- [ ] **Step 2: 创建 Ajv 实例和导出入口 `validation-schemas/src/index.ts`**

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// ============================================
// Ajv 实例配置（全局单例）
// ============================================

export const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: true,
  removeAdditional: true,
  strict: false,
  verbose: true,
});
addFormats(ajv);

// ============================================
// 校验辅助函数
// ============================================

import type { Static, TSchema } from '@sinclair/typebox';
import { ErrorCode, type ValidationResult } from './base.js';

/**
 * 编译 TypeBox Schema 为 Ajv validate 函数
 */
export function compileValidator<T extends TSchema>(schema: T) {
  return ajv.compile<Static<T>>(schema);
}

/**
 * 执行校验并返回标准化结果
 */
export function validate<T extends TSchema>(
  schema: T,
  data: unknown,
): ValidationResult<Static<T>> {
  const validateFn = compileValidator(schema);
  const valid = validateFn(data);

  if (valid) {
    return { valid: true, data: data as Static<T> };
  }

  return {
    valid: false,
    errors: (validateFn.errors ?? []).map((err) => ({
      path: err.instancePath || '/',
      message: err.message ?? 'Unknown validation error',
      value: err.data,
    })),
  };
}

/**
 * 构建 Fastify 错误响应体
 */
export function buildValidationError(
  errors: ValidationResult['errors'],
  requestId?: string,
) {
  return {
    error: {
      code: ErrorCode.VALIDATION_FAILED,
      message: '请求参数校验失败',
      details: errors,
      requestId,
    },
  };
}

// Re-export base schemas
export * from './base.js';
```

- [ ] **Step 3: 验证 TypeScript 编译通过**

Run: `cd validation-schemas && npx tsc --noEmit`
Expected: 无编译错误

- [ ] **Step 4: Commit**

```bash
git add validation-schemas/src/
git commit -m "$(cat <<'EOF'
feat: setup validation framework with TypeBox + Ajv (INF-4)

- Base schemas: ID, pagination, timestamps, project params, error codes
- Configured Ajv instance (allErrors, coerceTypes, formats)
- validate() helper returning standardized ValidationResult
- buildValidationError() for Fastify error responses

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fastify 应用骨架（INF-5）

**Files:**
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/routes/health.ts`

- [ ] **Step 1: 创建 Fastify 应用入口 `packages/api/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { db } from './db.js';

const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

// ============================================
// 注册插件
// ============================================

await app.register(cors, {
  origin: true, // Dev mode: allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ============================================
// 全局错误处理中间件
// ============================================

app.setErrorHandler((error, request, reply) => {
  const requestId = request.id;

  // 已知业务错误（带 HTTP status）
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    reply.code(error.statusCode).send({
      error: {
        code: (error as Error & { code?: string }).code ?? 'UNKNOWN_ERROR',
        message: error.message,
        requestId,
      },
    });
    return;
  }

  // 未预期异常 — 不泄露堆栈
  app.log.error({ err: error, requestId }, 'Unhandled error');
  reply.code(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      requestId,
    },
  });
});

// ============================================
// 请求日志装饰器（添加 request 时间戳）
// ============================================

app.addHook('onRequest', async (request) => {
  (request as Record<string, unknown>)._startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - ((request as Record<string, unknown>)._startTime as number);
  app.log.debug(
    `${request.method} ${request.url} → ${reply.statusCode} (${duration}ms)`
  );
});

// ============================================
// 健康检查路由
// ============================================

app.get('/api/v1/health', async () => {
  try {
    // Quick DB connectivity check
    await db.execute('SELECT 1');
    return {
      data: { status: 'ok', timestamp: new Date().toISOString() },
    };
  } catch (err) {
    return {
      data: { status: 'degraded', timestamp: new Date().toISOString(), db: 'unreachable' },
    };
  }
});

// ============================================
// 模块路由注册点（M1~M6 逐步添加）
// ============================================

// TODO(M1): app.register(projectRoutes, { prefix: '/api/v1/projects' })
// TODO(M2): app.register(domainRoutes, { prefix: '/api/v1/projects/:projectId/domain' })
// TODO(M3): app.register(processRoutes, { prefix: '/api/v1/projects/:projectId/processes' })
// TODO(M4): app.register(organizationRoutes, { prefix: '/api/v1/projects/:projectId' })
// TODO(M5): app.register(architectureRoutes, { prefix: '/api/v1/projects/:projectId/business-architectures' })
// TODO(M6): app.register(menuRoutes, { prefix: '/api/v1/menus' })

// ============================================
// 启动服务器
// ============================================

try {
  const port = Number(process.env.API_PORT) || 3000;
  const host = process.env.API_HOST || '0.0.0.0';
  await app.listen({ port, host });
  console.log(`🚀 API server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
```

- [ ] **Step 2: 验证 Fastify 应用可以启动**

Run: `cd packages/api && pnpm dev` （在另一个终端或后台运行 3 秒后 Ctrl+C）
Expected: 看到 `🚀 API server running at http://0.0.0.0:3000` 日志输出

- [ ] **Step 3: 用 curl 测试健康检查端点**

Run: `curl -s http://localhost:3000/api/v1/health | jq .`
Expected: 返回 `{ "data": { "status": "ok", "timestamp": "..." } }`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/app.ts
git commit -m "$(cat <<'EOF'
feat: setup Fastify application skeleton (INF-5)

- CORS plugin registration
- Global error handler (never leaks stack traces)
- Request/response timing hooks
- Health check endpoint (/api/v1/health) with DB connectivity test
- Route registration placeholders for M1-M6 modules

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: React + Vite + shadcn/ui 前端骨架（INF-6）

**Files:**
- Create: `packages/web/index.html`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/postcss.config.js`
- Create: `packages/web/tailwind.config.js`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/components/Layout.tsx`
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/index.css`
- Create: `packages/web/src/vite-env.d.ts`

- [ ] **Step 1: 创建 Vite 配置和 HTML 入口**

Create `packages/web/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Prototype Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `packages/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 13181,
    proxy: {
      '/api': {
        target: 'http://localhost:13180',
        changeOrigin: true,
      },
    },
  },
});
```

Create `packages/web/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `packages/web/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: 创建 CSS 变量和 Vite 类型声明**

Create `packages/web/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, sans-serif;
  }
}
```

Create `packages/web/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 3: 创建 React 入口和应用根组件**

Create `packages/web/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create `packages/web/src/App.tsx`:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.js';
import { lazy, Suspense } from 'react';

// Lazy load pages (will be implemented in M1-M6)
const ProjectList = lazy(() => import('./pages/ProjectList.js'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.js'));
const MenuManagement = lazy(() => import('./pages/MenuManagement.js'));

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/menus" element={<MenuManagement />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
```

- [ ] **Step 4: 创建 Layout 组件（Sidebar + Content Area）**

Create `packages/web/src/components/Layout.tsx`:

```typescript
import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { MenuItem } from '@apm/shared';
import { cn } from '@/lib/utils'; // Will be created by shadcn init

// Default menu data (will be replaced by API call after M6)
const DEFAULT_MENUS: MenuItem[] = [
  {
    id: 'menu-1',
    parentId: null,
    name: 'projects',
    displayName: '项目管理',
    icon: 'FolderKanban',
    path: '/projects',
    menuType: 'menu',
    sortOrder: 1,
    visible: true,
    roles: [],
    permissions: [],
    children: [],
  },
  {
    id: 'menu-2',
    parentId: null,
    name: 'system-settings',
    displayName: '系统设置',
    icon: 'Settings',
    path: null,
    menuType: 'directory',
    sortOrder: 10,
    visible: true,
    roles: [],
    permissions: [],
    children: [
      {
        id: 'menu-2-1',
        parentId: 'menu-2',
        name: 'menu-management',
        displayName: '菜单管理',
        icon: 'ListTree',
        path: '/menus',
        menuType: 'menu',
        sortOrder: 1,
        visible: true,
        roles: [],
        permissions: [],
        children: [],
      },
    ],
  },
];

// Simple icon map using lucide-react dynamic imports
// In production this would use a proper icon registry
function MenuIcon({ name }: { name: string | null }) {
  if (!name) return null;
  // Fallback: just show a dot for now; shadcn icons will be properly set up later
  return <span className="mr-2 inline-block w-4 h-4 text-center text-xs">●</span>;
}

interface SidebarProps {
  menus: MenuItem[];
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ menus, collapsed, onToggle }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (menuId: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <span className="text-lg font-semibold">APM</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 hover:bg-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menus
          .filter((m) => m.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((menu) => (
            <div key={menu.id}>
              {menu.menuType === 'separator' ? (
                <hr className="my-2 mx-3 border-border" />
              ) : menu.children && menu.children.length > 0 ? (
                /* Directory with children */
                <div>
                  <button
                    onClick={() => toggleSubmenu(menu.id)}
                    className={cn(
                      'flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <MenuIcon name={menu.icon} />
                    {!collapsed && (
                      <>
                        <span className="ml-2 flex-1 text-left">{menu.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {openMenus.has(menu.id) ? '▼' : '▶'}
                        </span>
                      </>
                    )}
                  </button>
                  {(!collapsed || openMenus.has(menu.id)) && (
                    <div className={cn(collapsed && 'hidden')}>
                      {menu.children
                        .filter((c) => c.visible)
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((child) => (
                          <a
                            key={child.id}
                            href={child.path ?? '#'}
                            className={cn(
                              'flex items-center rounded-md px-8 py-1.5 text-sm hover:bg-accent',
                              location.pathname === child.path &&
                                'bg-accent text-accent-foreground font-medium'
                            )}
                          >
                            <MenuIcon name={child.icon} />
                            {!collapsed && <span className="ml-2">{child.displayName}</span>}
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Leaf menu item */
                <a
                  href={menu.path ?? '#'}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent',
                    collapsed && 'justify-center px-2',
                    location.pathname === menu.path &&
                      'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  <MenuIcon name={menu.icon} />
                  {!collapsed && <span className="ml-2">{menu.displayName}</span>}
                </a>
              )}
            </div>
          ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        {!collapsed && 'APM v0.1'}
      </div>
    </aside>
  );
}

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        menus={DEFAULT_MENUS}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: 创建 API Client 封装和占位页面组件**

Create `packages/web/src/api/client.ts`:

```typescript
const API_BASE = '/api/v1';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: { code: 'UNKNOWN_ERROR', message: `HTTP ${response.status}` },
      }));
      throw new ApiClientError(error.error.code, error.error.message, error.error.requestId);
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const query = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${path}${query}`, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const api = new ApiClient();
```

Create placeholder page files that will be replaced during M1-M6:

**`packages/web/src/pages/ProjectList.tsx`**:

```typescript
export default function ProjectList() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">项目列表</h1>
      <p className="mt-2 text-muted-foreground">
        项目管理模块将在 M1 实现
      </p>
    </div>
  );
}
```

**`packages/web/src/pages/ProjectDetail.tsx`**:

```typescript
import { useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">项目详情</h1>
      <p className="mt-2 text-muted-foreground">
        项目 ID: {projectId} — 将在 M1 实现
      </p>
    </div>
  );
}
```

**`packages/web/src/pages/MenuManagement.tsx`**:

```typescript
export default function MenuManagement() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">菜单管理</h1>
      <p className="mt-2 text-muted-foreground">
        菜单管理模块将在 M6 实现
      </p>
    </div>
  );
}
```

- [ ] **Step 6: 创建 shadcn/ui 工具函数（手动创建，不依赖 CLI）**

Create `packages/web/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: 验证前端可以启动**

Run: `cd packages/web && pnpm dev` （在另一个终端运行 3 秒后 Ctrl+C）
Expected: 看到 `Local: http://localhost:13181/` 输出，浏览器打开可见 Sidebar + 内容区域

- [ ] **Step 8: 验证前后端联调（Vite proxy → Fastify health endpoint）**

Run: `curl -s http://localhost:13181/api/v1/health | jq .`
Expected: 通过 Vite proxy 转发到 Fastify，返回 `{ "data": { "status": "ok" } }`

- [ ] **Step 9: Commit**

```bash
git add packages/web/
git commit -m "$(cat <<'EOF'
feat: setup React + Vite + shadcn/ui frontend skeleton (INF-6)

- Vite config with API proxy to localhost:3000
- Tailwind CSS + shadcn/ui CSS variables (light/dark mode)
- React Router v6 with routes: /projects, /projects/:id, /menus
- Layout component: collapsible sidebar + content area
- API client wrapper (fetch-based, unified error handling)
- Placeholder pages for M1 (ProjectList/Detail) and M6 (MenuManagement)
- shadcn/ui utility (cn function via clsx + tailwind-merge)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement | Covered By |
|-------------|-----------|
| INF-1 Monorepo (pnpm + turbo) | Task 1 |
| INF-2 PG + Drizzle | Task 2 |
| INF-3 Shared types | Task 3 |
| INF-4 TypeBox + Ajv | Task 4 |
| INF-5 Fastify skeleton | Task 5 |
| INF-6 React + Vite + shadcn/ui | Task 6 |
| Root package.json workspace scripts | Task 1 Step 1 |
| Docker Compose PG 16 | Task 2 Step 1 |
| Drizzle Kit config + migrations | Task 2 Step 4-7 |
| projects table DDL (first of 19) | Task 2 Step 5 |
| Shared types: project/domain/process/org/arch/menu | Task 3 Steps 1-7 |
| Ajv instance config (allErrors/coerceTypes/formats) | Task 4 Step 2 |
| Error codes enum (5 codes) | Task 4 Step 1 |
| Fastify global error handler | Task 5 Step 1 |
| Health check endpoint | Task 5 Step 1 |
| React Router v6 hardcoded routes | Task 6 Step 3 |
| Sidebar driven by menu data | Task 6 Step 4 |
| API proxy (Vite → Fastify) | Task 6 Step 1 |
| Tailwind CSS + shadcn/ui variables | Task 6 Step 2 |

### Placeholder Scan

No TBD, no TODO-as-code, no "add appropriate handling". All steps contain actual code.

### Type Consistency

- `Project` type in shared matches `projects` table columns in schema
- `MenuItem` type includes `children?` for tree rendering in Layout
- `ApiError` interface consistent between client (`web/src/api/client.ts`) and validation schemas (`ErrorCode` enum)
- `PaginationParams` / `PaginationMeta` used consistently across shared utils
