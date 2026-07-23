import { create } from 'zustand';
import { api } from '../lib/api';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: Array<{ type: string; data: any }>;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (title?: string) => Promise<string>;
  sendMessage: (content: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  error: null,

  clearError: () => set({ error: null }),

  loadConversations: async () => {
    const res = await api.listConversations();
    set({ conversations: res.data });
  },

  selectConversation: async (id) => {
    set({ error: null });
    try {
      const res = await api.getConversation(id);
      set({
        currentConversationId: id,
        messages: res.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          cards: m.card_data ? (Array.isArray(m.card_data) ? m.card_data : [m.card_data]) : undefined,
          created_at: m.created_at,
        })),
      });
    } catch (err: any) {
      set({ error: `加载对话失败: ${err.message}` });
    }
  },

  createConversation: async (title) => {
    const res = await api.createConversation(title);
    const conv = res.data;
    set((state) => ({
      conversations: [conv, ...state.conversations],
      currentConversationId: conv.id,
      messages: [],
    }));
    return conv.id;
  },

  sendMessage: async (content) => {
    set({ error: null });
    const state = get();
    let conversationId = state.currentConversationId;

    const userMsg: Message = { role: 'user', content };
    const assistantMsg: Message = { role: 'assistant', content: '', cards: [] };

    try {
      if (!conversationId) {
        conversationId = await get().createConversation(content.slice(0, 20));
      }

      set((s) => ({
        messages: [...s.messages, userMsg, assistantMsg],
        isStreaming: true,
      }));

      await api.streamMessage(conversationId, content, (event, data) => {
        if (event === 'conversation_switch') {
          set((s) => ({
            currentConversationId: data.conversationId,
            conversations: [{ id: data.conversationId, title: data.title || '新商品解析', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0 }, ...s.conversations],
            messages: s.messages.filter(m => m.role !== 'assistant' || m.content),
          }));
          return;
        }
        if (event === 'conversation_title_update') {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === data.conversationId ? { ...c, title: data.title } : c
            ),
          }));
          return;
        }
        if (event === 'text_delta') {
          set((s) => {
            const messages = [...s.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content += data.text || '';
            }
            return { messages };
          });
        } else if (event === 'card') {
          set((s) => {
            const messages = [...s.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.cards = [...(lastMsg.cards || []), data];
            }
            return { messages };
          });
        } else if (event === 'done') {
          set({ isStreaming: false });
        } else if (event === 'error') {
          set((s) => {
            const messages = [...s.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content += `\n\n错误: ${data.message || '未知错误'}`;
            }
            return { messages, isStreaming: false };
          });
        }
      });
    } catch (err: any) {
      const hasAssistant = get().messages.length > 0 && get().messages[get().messages.length - 1]?.role === 'assistant';
      if (hasAssistant) {
        set((s) => {
          const messages = [...s.messages];
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
            messages.pop();
          }
          return { messages, isStreaming: false, error: `发送失败: ${err.message}` };
        });
      } else {
        set({ isStreaming: false, error: `发送失败: ${err.message}` });
      }
    }
  },

  deleteConversation: async (id) => {
    await api.deleteConversation(id);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
      messages: state.currentConversationId === id ? [] : state.messages,
    }));
  },
}));
