import { prisma } from '../../lib/prisma.js';
import { ConversationCache, SessionCache } from '../../lib/cache.js';

export interface ConversationContext {
  currentProduct?: { productId: string; name: string };
  selectedSku?: { skuId: string; specs: Record<string, string> } | null;
  pendingAction?: string;
  currentOrder?: { orderId: string; orderNo: string };
  selectedAddress?: { addressId: string; formatted: string };
  selectedBatch?: { batchId: string; area: string };
  willingToReceiveForOthers?: boolean;
}

export interface SessionState {
  state: string;
  context: ConversationContext;
}

export class ConversationService {
  async create(userId: string, title?: string) {
    return prisma.conversation.create({
      data: { user_id: userId, title: title || '新对话' },
    });
  }

  async listByUser(userId: string) {
    return prisma.conversation.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { updated_at: 'desc' },
    });
  }

  async getById(userId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, user_id: userId, is_active: true },
    });
  }

  async getMessages(conversationId: string, limit = 50) {
    return prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
      take: limit,
    });
  }

  async addMessage(conversationId: string, role: string, content: string, cardData?: any, toolCalls?: any) {
    const message = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        role,
        content,
        card_data: cardData,
        tool_calls: toolCalls,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        message_count: { increment: 1 },
        updated_at: new Date(),
      },
    });

    await ConversationCache.push(conversationId, { role, content });

    return message;
  }

  async getContext(conversationId: string): Promise<Array<{ role: string; content: string }>> {
    return ConversationCache.get(conversationId);
  }

  async getState(conversationId: string): Promise<SessionState> {
    const cached = await SessionCache.get(conversationId);
    if (cached) return cached as unknown as SessionState;
    return { state: 'IDLE', context: {} };
  }

  async setState(conversationId: string, state: SessionState) {
    await SessionCache.set(conversationId, state as any);
  }

  async delete(userId: string, conversationId: string) {
    await prisma.conversation.updateMany({
      where: { id: conversationId, user_id: userId },
      data: { is_active: false },
    });
  }
}

export const conversationService = new ConversationService();
