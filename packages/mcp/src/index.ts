/**
 * @module @apm/mcp
 * @description MCP Server for AI Prototype Manager.
 *              Runs as a sidecar process, exposing Design AI tools via MCP protocol.
 *              Supports both Streamable HTTP (modern clients like Qoder) and
 *              legacy SSE transport (Claude Code, etc.).
 *
 * Design Decisions:
 * - D-9: Sidecar deployment with independent lifecycle and port
 * - D-10: Passive tool — no conversation orchestration, no state management
 * - D-11: Enhanced returns (sideEffects) instead of pre-interception
 * - D-5: Tool description quality is the key success factor
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
// M6-Hardening: API 已强制鉴权，MCP 作为服务端使用 PAT（apm_pat_*）或 JWT 访问
const APM_API_TOKEN = process.env.APM_API_TOKEN || '';

if (!process.env.API_PORT && !process.env.API_BASE_URL) {
  console.warn('⚠️  MCP_PORT or API_BASE_URL not set. Using defaults. Activate environment first:\n' +
    '  source environments/set-env.sh dev1');
}

if (!APM_API_TOKEN) {
  console.warn('⚠️  APM_API_TOKEN not set. API 已强制鉴权，未配置 token 时所有工具调用将返回 401。\n' +
    '  请在环境变量中配置 PAT: export APM_API_TOKEN=apm_pat_xxx');
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
    headers: {
      // Content-Type only when a body is present — Fastify rejects
      // body-less requests (e.g. DELETE) that declare application/json
      // with FST_ERR_CTP_EMPTY_JSON_BODY.
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(APM_API_TOKEN ? { Authorization: `Bearer ${APM_API_TOKEN}` } : {}),
    },
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
// MCP Server Factory
// ============================================================

/**
 * Creates a fresh McpServer instance with all tools registered.
 * Called once per session because the MCP SDK Protocol class
 * does NOT support calling connect() more than once on the same instance.
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'APM Prototype Manager',
    version: '0.1.0',
  });
  registerSnapshotTools(server);
  registerProjectTools(server);
  registerDomainTools(server);
  registerOrganizationTools(server);
  registerProcessTools(server);
  return server;
}

// ============================================================
// Main: Express + Dual Transport (Streamable HTTP + Legacy SSE)
// ============================================================

async function main() {
  const app = express();
  app.use(express.json());

  // ----------------------------------------------------------
  // Transport 1: Streamable HTTP (modern clients like Qoder)
  //
  // Single endpoint handles GET (SSE stream for server-push),
  // POST (client messages), and DELETE (session termination).
  // No long-lived connection required — request-response model.
  // ----------------------------------------------------------
  const streamableTransports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport = sessionId ? streamableTransports.get(sessionId) : undefined;

    if (!transport) {
      // New session — only allowed for POST (initialization)
      if (req.method !== 'POST') {
        res.status(400).json({ error: 'No active session. Send an initialize POST first.' });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          console.log(`📡 [Streamable] Session initialized: ${id}`);
          streamableTransports.set(id, transport!);
        },
      });

      transport.onclose = () => {
        const sid = transport!.sessionId;
        if (sid) {
          streamableTransports.delete(sid);
          console.log(`👋 [Streamable] Session closed: ${sid}`);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // ----------------------------------------------------------
  // Transport 2: Legacy SSE (Claude Code, curl, older clients)
  //
  // GET /sse  — long-lived SSE stream (must stay open!)
  // POST /messages?sessionId=xxx  — client messages routed by session
  // ----------------------------------------------------------
  const sseTransports = new Map<string, SSEServerTransport>();

  app.get('/sse', async (req, res) => {
    console.log(`→ [SSE] GET /sse from ${req.ip}`);
    const server = createMcpServer();
    const transport = new SSEServerTransport('/messages', res);
    sseTransports.set(transport.sessionId, transport);

    res.on('close', () => {
      sseTransports.delete(transport.sessionId);
      server.close().catch(() => {});
      console.log(`👋 [SSE] Disconnected (session: ${transport.sessionId}, remaining: ${sseTransports.size})`);
    });

    try {
      await server.connect(transport);
      console.log(`📡 [SSE] Connected (session: ${transport.sessionId}, active: ${sseTransports.size})`);
    } catch (err) {
      console.error(`❌ [SSE] server.connect() failed:`, err);
      sseTransports.delete(transport.sessionId);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to initialize MCP session' });
      }
    }
  });

  app.post('/messages', async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const transport = sessionId ? sseTransports.get(sessionId) : undefined;

    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).json({
        error: 'No active SSE connection for sessionId',
        sessionId: sessionId ?? null,
        hint: 'Use Streamable HTTP transport at /mcp instead (recommended), or keep GET /sse open.',
      });
    }
  });

  // ----------------------------------------------------------
  // Health check
  // ----------------------------------------------------------
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'APM MCP Server',
      apiBaseUrl: API_BASE_URL,
      transports: {
        streamableHttp: '/mcp (recommended)',
        legacySse: '/sse + /messages',
      },
    });
  });

  // Start server
  app.listen(MCP_PORT, () => {
    console.log(`🚀 APM MCP Server running at http://localhost:${MCP_PORT}`);
    console.log(`   Streamable HTTP: http://localhost:${MCP_PORT}/mcp  (Qoder, modern clients)`);
    console.log(`   Legacy SSE:      http://localhost:${MCP_PORT}/sse  (Claude Code, curl)`);
    console.log(`   API backend:     ${API_BASE_URL}`);
    console.log(`   Health check:    http://localhost:${MCP_PORT}/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
