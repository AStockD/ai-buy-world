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
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (title?: string) => Promise<string>;
  sendMessage: (content: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,

  loadConversations: async () => {
    const res = await api.listConversations();
    set({ conversations: res.data });
  },

  selectConversation: async (id) => {
    const res = await api.getConversation(id);
    set({
      currentConversationId: id,
      messages: res.data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        cards: m.card_data ? [m.card_data] : undefined,
        created_at: m.created_at,
      })),
    });
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
    const state = get();
    let conversationId = state.currentConversationId;

    if (!conversationId) {
      conversationId = await get().createConversation(content.slice(0, 20));
    }

    const userMsg: Message = { role: 'user', content };
    const assistantMsg: Message = { role: 'assistant', content: '', cards: [] };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
    }));

    try {
      await api.streamMessage(conversationId, content, (event, data) => {
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
      set((s) => {
        const messages = [...s.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = `出错了: ${err.message}`;
        }
        return { messages, isStreaming: false };
      });
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
