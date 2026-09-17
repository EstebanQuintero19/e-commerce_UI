import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CartStore } from '../../core/cart.store';
import { Cart as CartModel, CartItem } from '../../core/models';
import { ProductImageComponent } from '../../shared/product-image';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';
import { PageMeta } from '../../shared/seo';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, FormsModule, CopPipe, ProductImageComponent],
  template: `
    @if (store.cart(); as cart) {
      @if (cart.items.length === 0) {
        <div class="empty">
          <h2>Tu bolsa está vacía</h2>
          <p>Lo que agregues desde la tienda aparece aquí.</p>
          <a class="btn btn-solid" routerLink="/productos">Ir a la tienda</a>
        </div>
      } @else {
        <div class="page-head">
          <h1>Tu bolsa <span class="muted count">{{ count(cart) }}</span></h1>
          <button type="button" class="link-btn muted" (click)="clear()" [disabled]="busy()">Vaciar bolsa</button>
        </div>
        <div class="two-col">
          <section class="items">
            @for (item of cart.items; track item.id) {
              <article class="item" [class.off]="!item.is_available">
                <a [routerLink]="['/productos', item.product_id]" class="thumb">
                  <app-product-image [src]="item.image" [name]="item.product_name" [category]="item.category" [color]="item.color" />
                </a>
                <div class="info">
                  <a [routerLink]="['/productos', item.product_id]" class="name">{{ item.product_name }}</a>
                  <div class="muted small">{{ [item.color, item.size].join(' · ') }}</div>
                  <div class="price">{{ item.unit_price | cop }}</div>
                  @if (!item.is_available) {
                    <div class="field-error">
                      @if (item.available === 0) { Sin unidades disponibles } @else { Solo quedan {{ item.available }}: baja la cantidad }
                    </div>
                  }
                  <div class="controls">
                    <div class="qty">
                      <button type="button" (click)="setQty(item, item.quantity - 1)" [disabled]="busy()" aria-label="Menos">−</button>
                      <span>{{ item.quantity }}</span>
                      <button type="button" (click)="setQty(item, item.quantity + 1)" [disabled]="busy() || item.quantity >= item.available" aria-label="Más">+</button>
                    </div>
                    <button type="button" class="link-btn muted" (click)="remove(item)" [disabled]="busy()">Quitar</button>
                  </div>
                </div>
                <div class="num line">{{ item.line_total | cop }}</div>
              </article>
            }
          </section>

          <aside class="summary sticky">
            <h2>Resumen</h2>
            <form class="coupon" (ngSubmit)="applyCoupon()">
              @if (cart.coupon; as c) {
                <div class="coupon-on">
                  <span>Cupón <strong>{{ c.code }}</strong></span>
                  <button type="button" class="link-btn muted" (click)="removeCoupon()">Quitar</button>
                </div>
                @if (c.error) { <div class="field-error">{{ c.error }}</div> }
              } @else {
                <input class="input" name="code" [(ngModel)]="code" placeholder="Código de cupón" maxlength="30" autocomplete="off" aria-label="Código de cupón" />
                <button class="btn" [disabled]="!code || busy()">Aplicar</button>
              }
            </form>
            <dl class="sum">
              <dt>Subtotal</dt><dd>{{ cart.subtotal | cop }}</dd>
              @if (cart.discount) { <dt>Descuento</dt><dd>−{{ cart.discount | cop }}</dd> }
              <dt class="muted small">Incluye IVA</dt><dd class="muted small">{{ cart.tax | cop }}</dd>
              <dt>Envío</dt><dd class="muted">según tu dirección</dd>
              <dt class="big">Total</dt><dd class="big">{{ cart.total | cop }}</dd>
            </dl>
            @if (cart.subtotal - cart.discount < cart.shipping_free_from) {
              <p class="muted small">Te faltan {{ cart.shipping_free_from - (cart.subtotal - cart.discount) | cop }} para envío gratis.</p>
            } @else {
              <p class="small ok">Tu pedido tiene envío gratis.</p>
            }
            <a class="btn btn-primary btn-block" routerLink="/checkout" [class.disabled]="!cart.can_checkout" [attr.aria-disabled]="!cart.can_checkout">Continuar al pago</a>
            @if (!cart.can_checkout) { <p class="field-error">Revisa los productos marcados antes de continuar.</p> }
          </aside>
        </div>
      }
    } @else {
      <div class="two-col" aria-busy="true">
        <div class="stack"><div class="sk" style="height:8rem"></div><div class="sk" style="height:8rem"></div></div>
        <div class="sk" style="height:16rem"></div>
      </div>
    }
  `,
  styles: `
    .count { font-weight: 400; font-size: 0.6em; margin-left: 0.25rem; }
    .items { border-top: 1px solid var(--ink); }
    .item { display: grid; grid-template-columns: 7rem 1fr auto; gap: 1.25rem; padding-block: 1.25rem; border-bottom: 1px solid var(--line); }
    .item.off .thumb { opacity: 0.5; }
    .thumb { width: 7rem; }
    .info { display: grid; gap: 0.2rem; align-content: start; justify-items: start; }
    .name { text-decoration: none; font-weight: 500; }
    .name:hover { text-decoration: underline; }
    .controls { display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem; }
    .line { font-weight: 500; }
    .summary { background: var(--wash); padding: 1.4286rem; }
    .coupon { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .coupon .input { flex: 1; min-width: 10rem; }
    .coupon-on { display: flex; justify-content: space-between; width: 100%; }
    .ok { color: var(--ok); }
    @media (max-width: 640px) { .item { grid-template-columns: 5.5rem 1fr; } .thumb { width: 5.5rem; } .line { grid-column: 2; } }
  `,
})
export class Cart {
  constructor() { inject(PageMeta).set('Tu bolsa'); }
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected store = inject(CartStore);
  protected busy = signal(false);
  protected code = '';

  count(cart: CartModel) {
    const n = cart.items.reduce((a, i) => a + i.quantity, 0);
    return `${n} ${n === 1 ? 'artículo' : 'artículos'}`;
  }

  private run(op: Observable<CartModel>, okMsg?: string) {
    this.busy.set(true);
    op.subscribe({
      next: (c) => { this.store.set(c); this.busy.set(false); if (okMsg) this.toast.ok(okMsg); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); this.store.refresh(); },
    });
  }

  setQty(item: CartItem, qty: number) {
    this.run(qty <= 0 ? this.api.removeCartItem(item.id) : this.api.updateCartItem(item.id, qty));
  }
  remove(item: CartItem) { this.run(this.api.removeCartItem(item.id)); }
  clear() { this.run(this.api.clearCart()); }
  applyCoupon() { this.run(this.api.applyCoupon(this.code), 'Cupón aplicado'); this.code = ''; }
  removeCoupon() { this.run(this.api.removeCoupon()); }
}
