const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { error: { message: `HTTP ${res.status}` } };
    }

    if (!res.ok) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    return data;
  }

  // Auth
  async register(email: string, password: string, name: string) {
    return this.request<any>('/auth/register', { method: 'POST', body: { email, password, name } });
  }

  async login(email: string, password: string) {
    return this.request<any>('/auth/login', { method: 'POST', body: { email, password } });
  }

  async refresh(refreshToken: string) {
    return this.request<any>('/auth/refresh', { method: 'POST', body: { refreshToken } });
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Addresses
  async listAddresses() {
    return this.request<any>('/addresses');
  }

  async createAddress(data: any) {
    return this.request<any>('/addresses', { method: 'POST', body: data });
  }

  async updateAddress(id: string, data: any) {
    return this.request<any>(`/addresses/${id}`, { method: 'PATCH', body: data });
  }

  async deleteAddress(id: string) {
    return this.request<any>(`/addresses/${id}`, { method: 'DELETE' });
  }

  async setDefaultAddress(id: string) {
    return this.request<any>(`/addresses/${id}/default`, { method: 'PATCH' });
  }

  // Products
  async listProducts() {
    return this.request<any>('/products');
  }

  async getProduct(id: string) {
    return this.request<any>(`/products/${id}`);
  }

  async parseProduct(url: string) {
    return this.request<any>('/products/parse', { method: 'POST', body: { url } });
  }

  // Wishlist
  async listWishlist() {
    return this.request<any>('/wishlist');
  }

  async addToWishlist(productId: string) {
    return this.request<any>('/wishlist', { method: 'POST', body: { product_id: productId } });
  }

  async removeFromWishlist(id: string) {
    return this.request<any>(`/wishlist/${id}`, { method: 'DELETE' });
  }

  // Orders
  async listOrders(status?: string, page = 1) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    return this.request<any>(`/orders?${params}`);
  }

  async getOrder(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  // Chat
  async listConversations() {
    return this.request<any>('/chat/conversations');
  }

  async createConversation(title?: string) {
    return this.request<any>('/chat/conversations', { method: 'POST', body: { title } });
  }

  async getConversation(id: string) {
    return this.request<any>(`/chat/conversations/${id}`);
  }

  async sendMessage(conversationId: string, content: string) {
    return this.request<any>('/chat/message', { method: 'POST', body: { conversationId, content } });
  }

  async streamMessage(
    conversationId: string,
    content: string,
    onEvent: (event: string, data: any) => void,
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ conversationId, content }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      throw new Error(error.error?.message || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'message';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            onEvent(currentEvent, JSON.parse(data));
          } catch {
            onEvent(currentEvent, data);
          }
          currentEvent = 'message';
        }
      }
    }
  }

  async deleteConversation(id: string) {
    return this.request<any>(`/chat/conversations/${id}`, { method: 'DELETE' });
  }

  // Batches
  async getBatchRecommendations() {
    return this.request<any>('/batches/recommend');
  }

  // Mock payment (for testing)
  async mockPaymentComplete(orderNo: string) {
    return this.request<any>('/webhooks/mock/payment-complete', {
      method: 'POST',
      body: { orderNo },
    });
  }

  // 订单操作
  async payOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}/pay`, { method: 'POST' });
  }

  async cancelOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}/cancel`, { method: 'POST' });
  }

  async confirmPickup(orderId: string, code: string) {
    return this.request<any>(`/orders/${orderId}/confirm-pickup`, {
      method: 'POST',
      body: { code },
    });
  }

  // Notifications
  async listNotifications(unreadOnly = false) {
    return this.request<any>(`/notifications?unread_only=${unreadOnly}`);
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request<any>('/notifications/read-all', { method: 'PATCH' });
  }
}

export const api = new ApiClient();
