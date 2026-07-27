/**
 * MCP Client — Agent Server 作为 MCP Client 连接 MCP Server（:13182）
 * F-M7-04：推荐卡片采纳时通过 MCP 协议调用工具
 *
 * 采用懒加载 + 单例连接，避免每次请求都重连
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { config } from '../config.js';

let clientPromise: Promise<Client> | null = null;

/**
 * 获取（或建立）到 MCP Server 的连接
 * 首次调用时初始化，之后复用
 */
async function getClient(): Promise<Client> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const url = new URL(`http://localhost:${config.mcp.port}/sse`);
    const transport = new SSEClientTransport(url);
    const client = new Client(
      { name: 'apm-agent-server', version: '0.1.0' },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  })().catch((err) => {
    // 连接失败时清空缓存以便下次重试
    clientPromise = null;
    throw err;
  });

  return clientPromise;
}

/**
 * 调用 MCP 工具
 * @param toolName 工具名（如 createEntity / addAction）
 * @param args 工具参数（对象）
 * @throws 若 MCP Server 未启动或工具调用失败，抛出错误由调用方处理
 */
export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = await getClient();
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });
  return result;
}

/** 关闭 MCP 连接（服务关闭时调用） */
export async function closeMcpClient(): Promise<void> {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // 忽略关闭错误
  }
  clientPromise = null;
}
