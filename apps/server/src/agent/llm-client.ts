import { config } from '../lib/config.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: LLMToolCall[];
}

const SYSTEM_PROMPT = `你是 AIBuyWorld 的 AI 购物助手，服务海外华人的跨境购物平台。

你的职责：
- 帮助用户通过粘贴商品链接完成跨境购物
- 管理心愿单、查询订单、推荐好物
- 引导用户完成地址选择、批次加入、支付下单的全流程

行为准则：
- 用中文回复，支持中英混合输入
- 识别到商品链接时，立即调用 flylink_parse 工具
- 涉及下单/支付等敏感操作时，必须向用户确认后再执行
- 回复简洁友好，避免冗长说明
- 不确定时主动询问，不编造信息`;

export class LLMClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.llm.apiKey;
    this.baseUrl = config.llm.apiUrl;
  }

  async chat(
    messages: LLMMessage[],
    tools?: any[],
    onDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    return this.chatWithModel(config.llm.model, messages, tools, onDelta);
  }

  async chatWithModel(
    model: string,
    messages: LLMMessage[],
    tools?: any[],
    onDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    if (!this.apiKey || this.apiKey === 'dev-llm-key') {
      return this.mockChat(messages, tools);
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        tools: tools?.length ? tools : undefined,
        stream: !!onDelta,
      }),
    });

    if (!res.ok) throw new Error(`LLM_ERROR: ${res.status}`);

    if (onDelta && res.body) {
      return this.handleStream(res.body, onDelta);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? null,
      toolCalls: (choice?.message?.tool_calls ?? []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
    };
  }

  private async handleStream(body: ReadableStream, onDelta: (text: string) => void): Promise<LLMResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    const toolCalls: LLMToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onDelta(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls[tc.index];
              if (existing) {
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              } else {
                toolCalls[tc.index] = {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                };
              }
            }
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    return { content: fullContent || null, toolCalls: toolCalls.filter(Boolean) };
  }

  private mockChat(messages: LLMMessage[], tools?: any[]): LLMResponse {
    const lastMsg = messages[messages.length - 1]?.content || '';

    // URL detection → flylink_parse
    if (lastMsg.match(/https?:\/\/.*(taobao|tmall|jd|1688)/i) || lastMsg.includes('口令')) {
      return {
        content: '正在为您解析商品链接...',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'flylink_parse',
          arguments: JSON.stringify({ input: lastMsg }),
        }],
      };
    }

    // Intent-based mock responses
    if (lastMsg.includes('订单') || lastMsg.includes('包裹')) {
      return {
        content: '好的，我来帮您查看订单。',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'query_orders',
          arguments: JSON.stringify({}),
        }],
      };
    }

    if (lastMsg.includes('心愿单') || lastMsg.includes('收藏')) {
      if (lastMsg.includes('加入') || lastMsg.includes('添加')) {
        return {
          content: '好的，已为您添加到心愿单。',
          toolCalls: [{
            id: `call_${Date.now()}`,
            name: 'manage_wishlist',
            arguments: JSON.stringify({ action: 'add' }),
          }],
        };
      }
      return {
        content: '这是您的心愿单：',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'manage_wishlist',
          arguments: JSON.stringify({ action: 'list' }),
        }],
      };
    }

    if (lastMsg.includes('运费') || lastMsg.includes('邮费')) {
      return {
        content: '为您查询运费信息。',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'calculate_shipping',
          arguments: JSON.stringify({ region: 'US' }),
        }],
      };
    }

    if (lastMsg.includes('推荐') || lastMsg.includes('大家都在买')) {
      return {
        content: '为您推荐近期热门好物：',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'get_recommendations',
          arguments: JSON.stringify({}),
        }],
      };
    }

    if (lastMsg.includes('地址')) {
      return {
        content: '为您查看地址信息。',
        toolCalls: [{
          id: `call_${Date.now()}`,
          name: 'manage_address',
          arguments: JSON.stringify({ action: 'list' }),
        }],
      };
    }

    if (lastMsg.includes('你好') || lastMsg.includes('hello') || lastMsg.includes('hi')) {
      return {
        content: '你好！我是 AIBuyWorld 的 AI 购物助手。你可以把淘宝、天猫等平台的商品链接发给我，我来帮你完成跨境购物。也可以查看订单、管理心愿单、查询运费等。有什么需要帮忙的？',
        toolCalls: [],
      };
    }

    if (lastMsg.includes('怎么买') || lastMsg.includes('购物流程')) {
      return {
        content: '购物流程很简单：\n1. 把商品链接发给我\n2. 我帮你解析商品信息\n3. 选择规格和地址\n4. 加入批次并支付\n\n你可以随时开始，把想买的商品链接发过来吧！',
        toolCalls: [],
      };
    }

    return {
      content: '我是 AIBuyWorld 的 AI 购物助手，可以帮你解析商品链接、查看订单、管理心愿单、查询运费等。请问有什么可以帮你的？',
      toolCalls: [],
    };
  }
}

export const llmClient = new LLMClient();
