import type { SessionState } from '../services/conversation/conversation.service.js';

export type SSEEmitter = (event: string, data: any) => void;

export interface ToolContext {
  userId: string;
  conversationId: string;
  emitSSE: SSEEmitter;
  userRegion: string;
  sessionState: SessionState;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    required?: string[];
    properties: Record<string, any>;
  };
  handler: (params: any, context: ToolContext) => Promise<any>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  getFunctionCallingSchema(): Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }> {
    return this.getAll().map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async execute(name: string, params: any, context: ToolContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not found`);
    return tool.handler(params, context);
  }
}

export const toolRegistry = new ToolRegistry();
