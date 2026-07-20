/**
 * @module project-tools
 * @description MCP tools for project management — list, create, get, update.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callApi } from '../index.js';

export function registerProjectTools(server: McpServer) {
  server.tool(
    'listProjects',
    `List all projects in the system. Returns project summaries with status and statistics.

Use this to:
- Check if a project name already exists before creating
- Find the project ID for subsequent operations
- Browse available projects`,
    {
      search: z.string().optional().describe('Optional search term to filter projects by name'),
      status: z.string().optional().describe('Optional filter: "active" or "archived"'),
    },
    async ({ search, status }) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const result = await callApi(`/api/v1/projects${qs}`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'createProject',
    `Create a new project. This is typically the first step when starting a new prototype.

The project name must be unique and follow the slug format (lowercase, starts with letter,
then lowercase letters/digits/hyphens). displayName is the human-readable name.

After creating a project, use getProjectSnapshot to see its initial (empty) state.`,
    {
      name: z.string().describe('Unique project identifier (slug format: lowercase, starts with letter, then lowercase/digits/hyphens)'),
      displayName: z.string().describe('Human-readable project name (e.g. "电商后台系统")'),
      description: z.string().optional().describe('Optional project description (max 500 chars)'),
    },
    async ({ name, displayName, description }) => {
      const body: Record<string, string> = { name, displayName };
      if (description) body.description = description;

      const result = await callApi('/api/v1/projects', { method: 'POST', body });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  server.tool(
    'getProject',
    `Get full details of a single project by ID.

Returns all project fields including description and config.
For a broader view of project contents, use getProjectSnapshot instead.`,
    {
      projectId: z.string().describe('Project ID (UUID)'),
    },
    async ({ projectId }) => {
      const result = await callApi(`/api/v1/projects/${projectId}`);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );
}
