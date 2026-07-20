/**
 * @module @apm/mcp
 * @description MCP Server for AI Prototype Manager.
 *              Runs as a sidecar process, exposing Design AI tools via MCP protocol.
 *              Supports SSE transport for remote connections (Claude Code, etc.).
 *
 * Design Decisions:
 * - D-9: Sidecar deployment with independent lifecycle and port
 * - D-10: Passive tool — no conversation orchestration, no state management
 * - D-11: Enhanced returns (sideEffects) instead of pre-interception
 * - D-5: Tool description quality is the key success factor
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { registerProjectTools } from './tools/project-tools.js';
import { registerDomainTools } from './tools/domain-tools.js';
import { registerOrganizationTools } from './tools/organization-tools.js';
import { registerSnapshotTools } from './tools/snapshot-tools.js';
import { registerProcessTools } from './tools/process-tools.js';

// ============================================================
// Configuration
// ============================================================

const MCP_PORT = Number(process.env.MCP_PORT) || 13182;
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.API_PORT || 13180}`;

if (!process.env.API_PORT && !process.env.API_BASE_URL) {
  console.warn('⚠️  MCP_PORT or API_BASE_URL not set. Using defaults. Activate environment first:\n' +
    '  source environments/set-env.sh dev1');
}

// ============================================================
// API Client Helper
// ============================================================

/**
 * Simple fetch wrapper for calling the APM API server.
 * All MCP tools use this to communicate with the backend.
 */
export async function callApi(path: string, options?: { method?: string; body?: unknown }) {
  const url = `${API_BASE_URL}${path}`;
  const method = options?.method ?? 'GET';

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (options?.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  // 204 No Content (e.g. DELETE) has no body — response.json() would throw.
  if (response.status === 204) {
    return { success: true };
  }

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    // Return error info for the AI to handle
    return { _error: true, status: response.status, ...data };
  }

  return data;
}

// ============================================================
// MCP Server Setup
// ============================================================

async function main() {
  // Create MCP server
  const server = new McpServer({
    name: 'APM Prototype Manager',
    version: '0.1.0',
  });

  // Register tool groups
  registerSnapshotTools(server);
  registerProjectTools(server);
  registerDomainTools(server);
  registerOrganizationTools(server);
  registerProcessTools(server);

  // Set up Express with SSE transport
  const app = express();
  app.use(express.json());

  // SSE endpoint for MCP connections
  let transport: SSEServerTransport | null = null;

  app.get('/sse', async (_req, res) => {
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
    console.log('📡 MCP client connected via SSE');
  });

  // Pass req.body explicitly to avoid "stream is not readable" error
  // caused by express.json() consuming the request stream first.
  app.post('/messages', async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(500).json({ error: 'No active SSE connection' });
    }
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'APM MCP Server', apiBaseUrl: API_BASE_URL });
  });

  // Start server
  app.listen(MCP_PORT, () => {
    console.log(`🚀 APM MCP Server running at http://localhost:${MCP_PORT}`);
    console.log(`   SSE endpoint: http://localhost:${MCP_PORT}/sse`);
    console.log(`   API backend:  ${API_BASE_URL}`);
    console.log(`   Health check: http://localhost:${MCP_PORT}/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
