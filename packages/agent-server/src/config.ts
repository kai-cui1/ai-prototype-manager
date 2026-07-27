/**
 * Agent Server 环境配置
 * 所有配置项从环境变量读取，无隐式默认数据库连接（遵循环境优先铁律）
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[agent-server] 缺少必需环境变量: ${name}，请先执行 source environments/set-env.sh`);
  }
  return value;
}

export const config = {
  /** Agent Server 监听端口 */
  port: parseInt(process.env.AGENT_PORT || '13183', 10),

  /** PostgreSQL 连接串（由环境系统动态生成，禁止硬编码） */
  databaseUrl: requireEnv('DATABASE_URL'),

  /** LLM Provider 配置 */
  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    model: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },

  /** Ollama 本地 Embedding 服务 */
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    embeddingModel: process.env.EMBEDDING_MODEL || 'bge-m3',
    embeddingDims: parseInt(process.env.EMBEDDING_DIMS || '1024', 10),
  },

  /** MCP Server 连接（Agent 作为 MCP Client） */
  mcp: {
    port: parseInt(process.env.MCP_PORT || '13182', 10),
  },

  /** 记忆系统配置 */
  memory: {
    /** 每轮对话检索 top-K */
    searchTopK: parseInt(process.env.MEMORY_TOP_K || '5', 10),
    /** 相似度阈值，低于此值不注入 */
    similarityThreshold: parseFloat(process.env.MEMORY_SIMILARITY_THRESHOLD || '0.5'),
    /** 同分类条目超过此数触发精炼 */
    refineThreshold: parseInt(process.env.MEMORY_REFINE_THRESHOLD || '30', 10),
  },

  /** 会话上下文压缩配置 */
  compression: {
    /** token 占 context window 的比例阈值 */
    tokenRatioThreshold: parseFloat(process.env.COMPRESS_RATIO || '0.8'),
    /** 保留最近 K 条不压缩 */
    keepRecentK: parseInt(process.env.COMPRESS_KEEP_RECENT || '6', 10),
    /** 默认 context window 大小 */
    contextWindow: parseInt(process.env.CONTEXT_WINDOW || '128000', 10),
  },
} as const;

export type AppConfig = typeof config;
