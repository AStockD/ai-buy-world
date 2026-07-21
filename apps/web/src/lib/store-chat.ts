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
    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
    }));

    try {
      const res = await api.sendMessage(conversationId, content);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.text,
        cards: res.data.cards,
      };
      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isStreaming: false,
      }));
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `出错了: ${err.message}`,
      };
      set((s) => ({
        messages: [...s.messages, errorMsg],
        isStreaming: false,
      }));
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
