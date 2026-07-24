import { intentRegistry } from './intent-registry.js';
import { toolRegistry, type ToolContext, type SSEEmitter } from './tool-registry.js';
import { llmClient, type LLMMessage } from './llm-client.js';
import { conversationService, type SessionState } from '../services/conversation/conversation.service.js';
import { config } from '../lib/config.js';

// Import all tool registrations
import './tools/flylink-parse.js';
import './tools/query-orders.js';
import './tools/manage-wishlist.js';
import './tools/calculate-shipping.js';
import './tools/manage-address.js';
import './tools/get-recommendations.js';

export interface AgentContext {
  userId: string;
  conversationId: string;
  userRegion: string;
}

export class AgentEngine {
  async processMessage(
    ctx: AgentContext,
    userMessage: string,
    emitSSE: SSEEmitter,
  ): Promise<string> {
    await intentRegistry.ensureLoaded();

    // Save user message
    await conversationService.addMessage(ctx.conversationId, 'user', userMessage);

    // Load conversation context
    const history = await conversationService.getContext(ctx.conversationId);
    const sessionState = await conversationService.getState(ctx.conversationId);

    // Build LLM messages
    const messages: LLMMessage[] = history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));

    // Get tool schema for function calling
    const toolSchema = toolRegistry.getFunctionCallingSchema();

    // Prepare tool context
    const toolContext: ToolContext = {
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      emitSSE,
      userRegion: ctx.userRegion,
      sessionState,
    };

    // Step 1: Intent recognition using lighter model (qwen-turbo)
    // Use intent model for tool calling decision
    const intentResponse = await llmClient.chatWithModel(
      config.llm.intentModel,
      messages,
      toolSchema,
    );

    let fullResponse = '';

    // Step 2: Handle tool calls if any
    if (intentResponse.toolCalls.length > 0) {
      for (const toolCall of intentResponse.toolCalls) {
        try {
          const params = JSON.parse(toolCall.arguments);
          const result = await toolRegistry.execute(toolCall.name, params, toolContext);

          // Feed tool result back to LLM for natural response
          messages.push({
            role: 'assistant',
            content: intentResponse.content || '',
          });
          messages.push({
            role: 'user',
            content: `[Tool result: ${toolCall.name} returned ${JSON.stringify(result)}]`,
          });

          // Step 3: Generate natural response using main model (qwen-plus) with streaming
          const followUp = await llmClient.chatWithModel(
            config.llm.model,
            messages,
            undefined,
            (text) => {
              emitSSE('text_delta', { text });
            },
          );

          if (followUp.content) {
            fullResponse = (fullResponse ? fullResponse + '\n' : '') + followUp.content;
          }
        } catch (err: any) {
          emitSSE('error', { code: 'TOOL_ERROR', message: err.message || '工具执行失败' });
        }
      }
    } else {
      // No tool calls, just generate response using main model with streaming
      const response = await llmClient.chatWithModel(
        config.llm.model,
        messages,
        undefined,
        (text) => {
          emitSSE('text_delta', { text });
        },
      );
      fullResponse = response.content || '';
    }

    // Save assistant response
    const assistantMsg = await conversationService.addMessage(
      ctx.conversationId,
      'assistant',
      fullResponse || '处理完成',
    );

    emitSSE('done', { messageId: assistantMsg.id });

    return fullResponse;
  }
}

export const agentEngine = new AgentEngine();
