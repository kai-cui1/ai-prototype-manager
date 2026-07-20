/**
 * @module snapshot-tools
 * @description MCP tools for project snapshot — the "entry ritual" for Design AI.
 *
 * D-14/D-15: Level 0 returns reference-level attributes (id/name/param counts),
 * NOT just numeric counts. AI can find actionable IDs directly in the snapshot.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi } from '../index.js';

export function registerSnapshotTools(server: McpServer) {
  server.tool(
    'getProjectSnapshot',
    `Get a project-wide context snapshot — the FIRST thing you should call when starting work on a project.

Returns a hierarchical overview of ALL modules in the project:
- Domain model: entities (with field counts), relations (with entity names), boundaries
- Organization: companies, departments, roles (with action/decision references), external entities
- Process: processes (with node/edge counts)
- Application: applications (with action/decision references and pages)
- Architecture: architecture nodes, process mappings

KEY DESIGN DECISION (D-14): This returns reference-level attributes, NOT just counts.
For example, roles include their actions[] with id/name/displayName/inputCount/outputCount,
so you can use action IDs directly when creating process nodes (nodeCreateActivity).

Parameters:
- level: 0 (default) = overview with reference attributes; 1 = detailed data for specific modules
- modules: (level=1 only) comma-separated list: domain,organization,process,application,architecture

After calling this, you have enough context to:
1. Reference any action/decision by ID in subsequent operations
2. Understand which entities, roles, and processes exist
3. Plan modifications without additional API calls`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
      level: z.number().optional().describe('Snapshot depth: 0 = overview (default), 1 = detailed module data'),
      modules: z.string().optional().describe('Level 1 only: comma-separated module names (domain,organization,process,application,architecture)'),
    },
    async ({ projectId, level, modules }) => {
      const params = new URLSearchParams();
      if (level !== undefined) params.set('level', String(level));
      if (modules) params.set('modules', modules);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const result = await callApi(`/api/v1/projects/${projectId}/snapshot${qs}`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );
}
