import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Address, AddressInput, Cart, Category, Coupon, CouponInput, Invoice, Order, OrderStatus, Paginated, Payment, Product,
  ProductFilters, ProductQuery, ShippingQuote, ShippingSettings, User, Variant, Wrapped,
} from './models';

// Un método por endpoint del backend. Devuelve `data` ya desenvuelto, salvo en listados paginados (traen `meta`).
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // ---- Catalog (público) ----
  // Caché corta en memoria: volver atrás o repetir una búsqueda no vuelve a pedir la página. Las escrituras de admin la vacían.
  private catalogCache = new Map<string, { at: number; obs: Observable<unknown> }>();
  private static CATALOG_TTL = 60_000;
  private cached<T>(key: string, make: () => Observable<T>): Observable<T> {
    const hit = this.catalogCache.get(key);
    if (hit && Date.now() - hit.at < ApiService.CATALOG_TTL) return hit.obs as Observable<T>;
    const obs = make().pipe(shareReplay(1));
    this.catalogCache.set(key, { at: Date.now(), obs });
    return obs;
  }
  invalidateCatalog() { this.catalogCache.clear(); }
  private bust<T>(obs: Observable<T>) { return obs.pipe(tap(() => this.invalidateCatalog())); }

  categories() {
    return this.cached('categories', () => this.http.get<Wrapped<Category[]>>(`${this.base}/categories`).pipe(map((r) => r.data)));
  }
  products(filters: ProductQuery = {}) {
    const params = this.params({ ...filters });
    return this.cached(`products?${params.toString()}`, () => this.http.get<Paginated<Product>>(`${this.base}/products`, { params }));
  }
  productFilters() {
    return this.cached('filters', () => this.http.get<ProductFilters>(`${this.base}/products/filters`));
  }
  product(id: number) {
    return this.cached(`product/${id}`, () => this.http.get<Wrapped<Product>>(`${this.base}/products/${id}`).pipe(map((r) => r.data)));
  }

  // ---- Favoritos ----
  favorites() {
    return this.http.get<Paginated<Product>>(`${this.base}/favorites`);
  }
  addFavorite(productId: number) {
    return this.http.put<void>(`${this.base}/favorites/${productId}`, {});
  }
  removeFavorite(productId: number) {
    return this.http.delete<void>(`${this.base}/favorites/${productId}`);
  }

  // ---- Cuenta ----
  updateProfile(input: { name?: string; email?: string }) {
    return this.http.put<Wrapped<User>>(`${this.base}/auth/me`, input).pipe(map((r) => r.data));
  }
  changePassword(current_password: string, password: string, password_confirmation: string) {
    return this.http.put<void>(`${this.base}/auth/password`, { current_password, password, password_confirmation });
  }
  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, { email });
  }
  resetPassword(input: { token: string; email: string; password: string; password_confirmation: string }) {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, input);
  }

  // ---- Addresses ----
  addresses() {
    return this.http.get<Wrapped<Address[]>>(`${this.base}/addresses`).pipe(map((r) => r.data));
  }
  createAddress(input: AddressInput) {
    return this.http.post<Wrapped<Address>>(`${this.base}/addresses`, input).pipe(map((r) => r.data));
  }
  updateAddress(id: number, input: AddressInput) {
    return this.http.put<Wrapped<Address>>(`${this.base}/addresses/${id}`, input).pipe(map((r) => r.data));
  }
  deleteAddress(id: number) {
    return this.http.delete<void>(`${this.base}/addresses/${id}`);
  }

  // ---- Cart ----
  cart() {
    return this.http.get<Wrapped<Cart>>(`${this.base}/cart`).pipe(map((r) => r.data));
  }
  addToCart(variant_id: number, quantity: number) {
    return this.http.post<Wrapped<Cart>>(`${this.base}/cart/items`, { variant_id, quantity }).pipe(map((r) => r.data));
  }
  updateCartItem(itemId: number, quantity: number) {
    return this.http.put<Wrapped<Cart>>(`${this.base}/cart/items/${itemId}`, { quantity }).pipe(map((r) => r.data));
  }
  removeCartItem(itemId: number) {
    return this.http.delete<Wrapped<Cart>>(`${this.base}/cart/items/${itemId}`).pipe(map((r) => r.data));
  }

  clearCart() {
    return this.http.delete<Wrapped<Cart>>(`${this.base}/cart`).pipe(map((r) => r.data));
  }
  applyCoupon(code: string) {
    return this.http.post<Wrapped<Cart>>(`${this.base}/cart/coupon`, { code }).pipe(map((r) => r.data));
  }
  removeCoupon() {
    return this.http.delete<Wrapped<Cart>>(`${this.base}/cart/coupon`).pipe(map((r) => r.data));
  }
  shippingQuote(address_id: number) {
    return this.http.get<ShippingQuote>(`${this.base}/shipping/quote`, { params: { address_id } });
  }

  // ---- Orders ----
  orders(filters: { status?: OrderStatus; page?: number } = {}) {
    return this.http.get<Paginated<Order>>(`${this.base}/orders`, { params: this.params(filters) });
  }
  order(id: number) {
    return this.http.get<Wrapped<Order>>(`${this.base}/orders/${id}`).pipe(map((r) => r.data));
  }
  placeOrder(address_id: number) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders`, { address_id }).pipe(map((r) => r.data));
  }
  cancelOrder(id: number) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders/${id}/cancel`, {}).pipe(map((r) => r.data));
  }

  requestReturn(id: number, reason: string) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders/${id}/return`, { reason }).pipe(map((r) => r.data));
  }

  // ---- Payments ----
  paymentsOf(order_id: number) {
    return this.http.get<Wrapped<Payment[]>>(`${this.base}/payments`, { params: { order_id } }).pipe(map((r) => r.data));
  }
  pay(order_id: number, idempotency_key: string) {
    return this.http.post<Wrapped<Payment>>(`${this.base}/payments`, { order_id, idempotency_key }).pipe(map((r) => r.data));
  }
  payment(id: number) {
    return this.http.get<Wrapped<Payment>>(`${this.base}/payments/${id}`).pipe(map((r) => r.data));
  }
  // Solo existe con PAYMENT_DRIVER=fake en el backend. Con Mercado Pago se redirige a payment.checkout_url.
  confirmFakePayment(id: number) {
    return this.http.post<Wrapped<Payment>>(`${this.base}/payments/${id}/confirm`, {}).pipe(map((r) => r.data));
  }

  // ---- Invoices ----
  invoices(page = 1) {
    return this.http.get<Paginated<Invoice>>(`${this.base}/invoices`, { params: { page } });
  }
  invoice(id: number) {
    return this.http.get<Wrapped<Invoice>>(`${this.base}/invoices/${id}`).pipe(map((r) => r.data));
  }
  invoicePdf(id: number) {
    return this.http.get(`${this.base}/invoices/${id}/pdf`, { responseType: 'blob' });
  }

  // ---- Admin: pedidos, cupones, reembolsos ----
  shipOrder(id: number, carrier: string, tracking_number: string) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders/${id}/ship`, { carrier, tracking_number }).pipe(map((r) => r.data));
  }
  deliverOrder(id: number) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders/${id}/deliver`, {}).pipe(map((r) => r.data));
  }
  rejectReturn(id: number) {
    return this.http.post<Wrapped<Order>>(`${this.base}/orders/${id}/return/reject`, {}).pipe(map((r) => r.data));
  }
  refundPayment(paymentId: number) {
    return this.http.post<Wrapped<Payment>>(`${this.base}/payments/${paymentId}/refund`, {}).pipe(map((r) => r.data));
  }
  coupons() {
    return this.http.get<Paginated<Coupon>>(`${this.base}/coupons`);
  }
  saveCoupon(input: Partial<CouponInput>, id?: number) {
    return id
      ? this.http.put<Wrapped<Coupon>>(`${this.base}/coupons/${id}`, input).pipe(map((r) => r.data))
      : this.http.post<Wrapped<Coupon>>(`${this.base}/coupons`, input).pipe(map((r) => r.data));
  }
  deleteCoupon(id: number) {
    return this.http.delete<void>(`${this.base}/coupons/${id}`);
  }

  // ---- Admin: envíos ----
  shippingSettings() {
    return this.http.get<ShippingSettings>(`${this.base}/shipping/settings`);
  }
  saveShippingSettings(s: ShippingSettings) {
    return this.http.put<ShippingSettings>(`${this.base}/shipping/settings`, s);
  }

  // ---- Admin: catálogo e inventario ----
  saveCategory(category: Partial<Category>, id?: number) {
    return this.bust(
      id
        ? this.http.put<Wrapped<Category>>(`${this.base}/categories/${id}`, category).pipe(map((r) => r.data))
        : this.http.post<Wrapped<Category>>(`${this.base}/categories`, category).pipe(map((r) => r.data)),
    );
  }
  deleteCategory(id: number) {
    return this.bust(this.http.delete<void>(`${this.base}/categories/${id}`));
  }
  saveProduct(product: Partial<Product> & { category_id?: number }, id?: number) {
    return this.bust(
      id
        ? this.http.put<Wrapped<Product>>(`${this.base}/products/${id}`, product).pipe(map((r) => r.data))
        : this.http.post<Wrapped<Product>>(`${this.base}/products`, product).pipe(map((r) => r.data)),
    );
  }
  deleteProduct(id: number) {
    return this.bust(this.http.delete<void>(`${this.base}/products/${id}`));
  }
  saveVariant(productId: number, variant: Partial<Variant>, id?: number) {
    return this.bust(
      id
        ? this.http.put<Wrapped<Variant>>(`${this.base}/variants/${id}`, variant).pipe(map((r) => r.data))
        : this.http.post<Wrapped<Variant>>(`${this.base}/products/${productId}/variants`, variant).pipe(map((r) => r.data)),
    );
  }
  uploadProductImage(productId: number, file: File, position = 0, color: string | null = null) {
    const form = new FormData();
    form.append('image', file);
    form.append('position', String(position));
    if (color) form.append('color', color);
    return this.bust(this.http.post<Wrapped<Product>>(`${this.base}/products/${productId}/images`, form).pipe(map((r) => r.data)));
  }
  deleteProductImage(imageId: number) {
    return this.bust(this.http.delete<void>(`${this.base}/product-images/${imageId}`));
  }
  adjustStock(variantId: number, delta: number, note?: string) {
    return this.bust(this.http.post<Wrapped<Variant>>(`${this.base}/variants/${variantId}/stock/adjust`, { delta, note }).pipe(map((r) => r.data)));
  }

  private params(obj: Record<string, unknown>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }
}
