// Espejo de los schemas Swagger del backend (/api/documentation). Montos en COP enteros.

export type Role = 'customer' | 'admin';
export interface User { id: number; name: string; email: string; role: Role; }
export interface AuthToken { token: string; user: User; }

export interface Category { id: number; name: string; slug: string; is_active: boolean; }
export interface Variant {
  id: number; product_id: number; sku: string; size: string | null; color: string | null;
  price: number; available: number; is_active: boolean;
  stock?: number; reserved?: number; low_stock_threshold?: number; // solo admin
}
export interface ProductImage { id: number; url: string; }
export interface Product {
  id: number; name: string; slug: string; description: string | null; is_active: boolean;
  image: string | null; images: ProductImage[];
  category?: Category; variants?: Variant[];
}

export interface AddressInput {
  recipient: string; phone: string; line1: string; line2?: string | null;
  city: string; state: string; postal_code?: string | null;
}
export interface Address extends AddressInput { id: number; }

export interface CartItem {
  id: number; variant_id: number; product_id: number; sku: string; name: string;
  unit_price: number; quantity: number; available: number; is_available: boolean; line_total: number;
}
export interface CartCoupon { code: string; discount: number; error: string | null; }
export interface Cart {
  id: number; items: CartItem[]; coupon: CartCoupon | null;
  subtotal: number; discount: number; tax: number; total: number; // total sin envío
  shipping_free_from: number; can_checkout: boolean;
}
export interface ShippingQuote { shipping_cost: number; free_from: number; total: number; }

export type CouponType = 'percent' | 'fixed';
export interface CouponInput {
  code: string; type: CouponType; value: number; min_subtotal?: number; max_uses?: number | null;
  starts_at?: string | null; expires_at?: string | null; is_active?: boolean;
}
export interface Coupon extends CouponInput { id: number; uses: number; }

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'return_requested' | 'refunded';
export interface OrderItem {
  id: number; variant_id: number | null; sku: string; name: string;
  unit_price: number; quantity: number; line_total: number;
}
export interface Shipment { carrier: string; tracking_number: string; shipped_at: string; delivered_at: string | null; }
export interface OrderReturn { reason: string; requested_at: string; refunded_at: string | null; }
export interface Order {
  id: number; user_id: number; status: OrderStatus;
  subtotal: number; discount: number; coupon_code: string | null; tax: number; shipping_cost: number; total: number;
  shipping_address: AddressInput; shipment: Shipment | null; return: OrderReturn | null;
  items?: OrderItem[]; created_at: string;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refund_required' | 'refunded';
export interface Payment {
  id: number; order_id: number; driver: string; status: PaymentStatus; amount: number;
  gateway_ref: string | null; checkout_url: string | null; created_at: string;
}

export interface InvoiceItem { id: number; sku: string; name: string; unit_price: number; quantity: number; tax: number; line_total: number; }
export interface Invoice {
  id: number; number: string; order_id: number; customer: AddressInput & { name: string; email: string };
  subtotal: number; discount: number; tax: number; shipping_cost: number; total: number; issued_at: string; items?: InvoiceItem[];
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}
export interface Wrapped<T> { data: T; }
