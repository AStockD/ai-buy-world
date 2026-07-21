import { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from './middleware/auth.js';
import { conversationService } from '../services/conversation/conversation.service.js';
import { agentEngine } from '../agent/agent-engine.js';
import { prisma } from '../lib/prisma.js';

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // 创建对话
  app.post('/conversations', async (req: FastifyRequest<{ Body: { title?: string } }>) => {
    const userId = (req as any).userId;
    const conv = await conversationService.create(userId, req.body.title);
    return { success: true, data: conv };
  });

  // 对话列表
  app.get('/conversations', async (req) => {
    const userId = (req as any).userId;
    const list = await conversationService.listByUser(userId);
    return { success: true, data: list };
  });

  // 对话详情 + 历史消息
  app.get('/conversations/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    const conv = await conversationService.getById(userId, req.params.id);
    if (!conv) return { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } };

    const messages = await conversationService.getMessages(req.params.id);
    return { success: true, data: { ...conv, messages } };
  });

  // 删除对话
  app.delete('/conversations/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    await conversationService.delete(userId, req.params.id);
    return { success: true };
  });

  // 发送消息（非流式）
  app.post('/message', async (req: FastifyRequest<{ Body: { conversationId: string; content: string } }>) => {
    const userId = (req as any).userId;
    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return { success: false, error: { code: 'MISSING_PARAMS', message: '缺少对话ID或消息内容' } };
    }

    const conv = await conversationService.getById(userId, conversationId);
    if (!conv) return { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } };

    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Collect SSE events in memory for non-streaming response
    const events: Array<{ event: string; data: any }> = [];
    const emitSSE = (event: string, data: any) => {
      events.push({ event, data });
    };

    const responseText = await agentEngine.processMessage(
      { userId, conversationId, userRegion: user?.region || 'US' },
      content,
      emitSSE,
    );

    const cards = events.filter(e => e.event === 'card').map(e => e.data);

    return {
      success: true,
      data: {
        text: responseText,
        cards,
        events,
      },
    };
  });

  // SSE 流式消息
  app.post('/stream', async (req: FastifyRequest<{ Body: { conversationId: string; content: string } }>, reply) => {
    const userId = (req as any).userId;
    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return reply.code(400).send({ success: false, error: { code: 'MISSING_PARAMS', message: '缺少对话ID或消息内容' } });
    }

    const conv = await conversationService.getById(userId, conversationId);
    if (!conv) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    // SSE setup
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat
    const heartbeat = setInterval(() => {
      sendEvent('heartbeat', {});
    }, 30000);

    try {
      await agentEngine.processMessage(
        { userId, conversationId, userRegion: user?.region || 'US' },
        content,
        sendEvent,
      );
    } catch (err: any) {
      sendEvent('error', { code: 'AGENT_ERROR', message: err.message || '处理失败' });
    } finally {
      clearInterval(heartbeat);
      reply.raw.end();
    }
  });
}
