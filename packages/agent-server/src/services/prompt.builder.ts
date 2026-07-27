/**
 * Prompt Builder — System Prompt 组装
 * 将角色定义 + 模式指令 + 用户记忆 + @ 上下文 + 概念元信息 拼装为完整 System Prompt
 */

export interface PromptBuildOptions {
  mode: 'copilot' | 'executor';
  memories: Array<{ content: string; category: string }>;
  contextRefs: Array<{ area: string; label: string; data: any }>;
}

/**
 * 系统特有概念元信息
 * 帮助 LLM 理解本系统的领域概念（Design AI 元信息需求）
 */
const CONCEPT_META = `## 系统概念说明
本系统是 AI 原型设计工具（APM），核心概念：
- **项目（Project）**：顶层容器，包含领域模型、业务流程、组织架构
- **实体（Entity）**：领域模型中的业务对象，含字段（Field）定义
- **关系（Relation）**：实体间的关联（association/composition/generalization）
- **角色（Role）**：组织架构中的参与者，可绑定行为（Action）和决策（Decision）
- **业务流程（Process）**：由活动节点（Activity）和决策节点（Decision）组成的有向图
- **外部实体（ExternalEntity）**：系统边界外的交互对象

## 可用 MCP 工具
你可以通过推荐卡片调用以下工具写入数据：
- createEntity / addEntityField / createRelation / listEntities
- createRole / addAction / createExternalEntity / addDecision
- createProcess / addActivityNode / addDecisionNode / createEdge
- createProject / getProjectSnapshot / listProjects`;

/**
 * 组装完整 System Prompt
 */
export function buildSystemPrompt(options: PromptBuildOptions): string {
  const sections: string[] = [];

  // 1. 基础角色定义
  sections.push(
    '你是 APM 内置设计助手，帮助用户进行软件产品的领域建模、角色定义和业务流程设计。' +
    '回复使用中文，保持简洁专业。'
  );

  // 2. 模式指令
  if (options.mode === 'copilot') {
    sections.push(
      '## 当前模式：副驾（Copilot）\n' +
      '输出推荐卡片供用户确认，不直接执行写入。\n' +
      '推荐卡片格式：在回复末尾输出 ```json card 代码块，结构为：\n' +
      '{"title":"卡片标题","description":"设计依据","items":[{"kind":"entity","label":"一行摘要","tool":"createEntity","args":{...},"dependencies":[]}]}'
    );
  } else {
    sections.push(
      '## 当前模式：执行者（Executor）\n' +
      '可直接调用 MCP 工具执行写入操作。\n' +
      '高危操作（删除、批量修改）前需先向用户确认。'
    );
  }

  // 3. 用户记忆
  if (options.memories.length > 0) {
    const memText = options.memories
      .map((m) => `- [${m.category}] ${m.content}`)
      .join('\n');
    sections.push(`## 用户偏好与记忆\n${memText}`);
  }

  // 4. @ 上下文
  if (options.contextRefs.length > 0) {
    const ctxText = options.contextRefs
      .map((c) => `### ${c.area} > ${c.label}\n\`\`\`json\n${JSON.stringify(c.data, null, 2)}\n\`\`\``)
      .join('\n');
    sections.push(`## 用户引用的页面上下文\n${ctxText}`);
  }

  // 5. 概念元信息
  sections.push(CONCEPT_META);

  return sections.join('\n\n');
}
