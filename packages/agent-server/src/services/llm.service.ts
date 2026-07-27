/**
 * LLM Service — Vercel AI SDK 封装
 * 提供 Provider 配置化 + streamText 流式调用
 * F-M7-02: 消息收发（流式）
 */
import { streamText, generateText } from 'ai';
import type { CoreMessage, StreamTextResult } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '../config.js';

/**
 * 获取当前配置的 LLM Provider 实例
 * 支持 anthropic / openai，通过环境变量 LLM_PROVIDER 切换
 */
function getProvider() {
  switch (config.llm.provider) {
    case 'anthropic':
      if (!config.llm.anthropicApiKey) {
        throw new Error('[llm-service] 未配置 ANTHROPIC_API_KEY，无法调用 Anthropic 模型（请在启动 agent-server 前 export 该变量）');
      }
      return createAnthropic({ apiKey: config.llm.anthropicApiKey });
    case 'openai':
      if (!config.llm.openaiApiKey) {
        throw new Error('[llm-service] 未配置 OPENAI_API_KEY，无法调用 OpenAI 模型（请在启动 agent-server 前 export 该变量）');
      }
      return createOpenAI({ apiKey: config.llm.openaiApiKey });
    default:
      throw new Error(`[llm-service] 未知 LLM_PROVIDER: ${config.llm.provider}`);
  }
}

/**
 * 获取当前模型实例
 */
function getModel() {
  const provider = getProvider();
  return provider(config.llm.model);
}

export interface ChatOptions {
  system: string;
  messages: CoreMessage[];
  onChunk?: (chunk: { type: string; data: any }) => void;
  abortSignal?: AbortSignal;
}

/**
 * 流式对话调用
 * 返回 AI SDK 的 StreamTextResult，由调用方消费流
 */
export function streamChat(options: ChatOptions): StreamTextResult<any, any> {
  const model = getModel();

  return streamText({
    model,
    system: options.system,
    messages: options.messages,
    maxSteps: 5,
    abortSignal: options.abortSignal,
  });
}

/**
 * 非流式调用（用于记忆提取、标题生成等后台任务）
 */
export async function generateChat(options: {
  system: string;
  messages: CoreMessage[];
}): Promise<string> {
  const model = getModel();

  const result = await generateText({
    model,
    system: options.system,
    messages: options.messages,
  });

  return result.text;
}
