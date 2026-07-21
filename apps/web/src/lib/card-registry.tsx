'use client';

import { type ComponentType } from 'react';
import { ProductCard } from '../components/cards/ProductCard';
import { OrderCard } from '../components/cards/OrderCard';
import { WishlistCard } from '../components/cards/WishlistCard';
import { ShippingCard } from '../components/cards/ShippingCard';
import { AddressCard } from '../components/cards/AddressCard';
import { RecommendationCard } from '../components/cards/RecommendationCard';
import { AddressSelectCard } from '../components/cards/AddressSelectCard';
import { WillingCard } from '../components/cards/WillingCard';
import { BatchSelectCard } from '../components/cards/BatchSelectCard';
import { PaymentCard } from '../components/cards/PaymentCard';
import { SuccessCard } from '../components/cards/SuccessCard';

type CardComponent = ComponentType<{ data: any; onAction?: (action: string, payload?: any) => void }>;

const registry = new Map<string, CardComponent>();

export function registerCard(type: string, component: CardComponent) {
  registry.set(type, component);
}

export function getCardComponent(type: string): CardComponent | undefined {
  return registry.get(type);
}

const defaultCards: Record<string, CardComponent> = {
  product_card: ProductCard as CardComponent,
  order_card: OrderCard as CardComponent,
  wishlist_card: WishlistCard as CardComponent,
  shipping_card: ShippingCard as CardComponent,
  address_card: AddressCard as CardComponent,
  recommendation_card: RecommendationCard as CardComponent,
  address_select_card: AddressSelectCard as CardComponent,
  willing_card: WillingCard as CardComponent,
  batch_select_card: BatchSelectCard as CardComponent,
  payment_card: PaymentCard as CardComponent,
  success_card: SuccessCard as CardComponent,
};

for (const [type, component] of Object.entries(defaultCards)) {
  registry.set(type, component);
}
