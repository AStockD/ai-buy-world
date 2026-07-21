import { create } from 'zustand';

export type PurchaseState =
  | 'IDLE'
  | 'PRODUCT_VIEWED'
  | 'SKU_SELECTED'
  | 'ADDRESS_CONFIRM'
  | 'WILLING_CONFIRM'
  | 'BATCH_SELECT'
  | 'PAYMENT_INIT'
  | 'PROCESSING'
  | 'SUCCESS';

interface PurchaseContext {
  productId?: string;
  productName?: string;
  productImage?: string;
  skuId?: string;
  price?: number;
  shippingFee?: number;
  totalAmount?: number;
  addressId?: string;
  batchId?: string;
  orderId?: string;
  orderNo?: string;
  paymentUrl?: string;
}

interface SessionState {
  purchaseState: PurchaseState;
  context: PurchaseContext;
}

interface SessionStoreState {
  session: SessionState;
  setPurchaseState: (state: PurchaseState) => void;
  setContext: (ctx: Partial<PurchaseContext>) => void;
  reset: () => void;
}

const initial: SessionState = {
  purchaseState: 'IDLE',
  context: {},
};

export const useSessionStore = create<SessionStoreState>((set) => ({
  session: { ...initial },

  setPurchaseState: (purchaseState) =>
    set((s) => ({
      session: { ...s.session, purchaseState },
    })),

  setContext: (ctx) =>
    set((s) => ({
      session: {
        ...s.session,
        context: { ...s.session.context, ...ctx },
      },
    })),

  reset: () => set({ session: { ...initial } }),
}));
