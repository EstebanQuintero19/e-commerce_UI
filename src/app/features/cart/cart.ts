import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CartStore } from '../../core/cart.store';
import { Cart as CartModel, CartItem } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, FormsModule, CopPipe],
  template: `
    <div class="page-head"><h1>Carrito</h1></div>
    @if (store.cart(); as cart) {
      @if (cart.items.length === 0) {
        <div class="empty">
          <h2>Tu carrito está vacío</h2>
          <p>Lo que agregues desde la tienda aparece aquí.</p>
          <a class="btn btn-solid" routerLink="/productos">Ir a la tienda</a>
        </div>
      } @else {
        <div class="two-col">
          <section class="stack">
            @for (item of cart.items; track item.id) {
              <div class="card item" [class.off]="!item.is_available">
                <div>
                  <a [routerLink]="['/productos', item.product_id]" class="name">{{ item.name }}</a>
                  <div class="muted small">{{ item.sku }} · {{ item.unit_price | cop }} c/u</div>
                  @if (!item.is_available) {
                    <div class="field-error">
                      @if (item.available === 0) { Sin unidades disponibles } @else { Solo quedan {{ item.available }}: baja la cantidad }
                    </div>
                  }
                </div>
                <div class="qty">
                  <button type="button" (click)="setQty(item, item.quantity - 1)" [disabled]="busy()" aria-label="Menos">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" (click)="setQty(item, item.quantity + 1)" [disabled]="busy() || item.quantity >= item.available" aria-label="Más">+</button>
                </div>
                <div class="num total">{{ item.line_total | cop }}</div>
                <button type="button" class="btn btn-ghost btn-sm" (click)="remove(item)" [disabled]="busy()">Quitar</button>
              </div>
            }
            <div><button type="button" class="btn btn-ghost btn-sm" (click)="clear()" [disabled]="busy()">Vaciar carrito</button></div>
          </section>

          <aside class="card sticky">
            <h2>Resumen</h2>
            <form class="row" (ngSubmit)="applyCoupon()" style="margin-bottom:1rem">
              @if (cart.coupon; as c) {
                <span class="badge badge-ok">{{ c.code }}</span>
                @if (c.error) { <span class="field-error" style="margin:0">{{ c.error }}</span> }
                <button type="button" class="btn btn-ghost btn-sm" (click)="removeCoupon()">Quitar</button>
              } @else {
                <input class="input" style="flex:1" name="code" [(ngModel)]="code" placeholder="Cupón" aria-label="Código de cupón" />
                <button class="btn btn-sm" [disabled]="!code || busy()">Aplicar</button>
              }
            </form>
            <dl class="sum">
              <dt>Subtotal</dt><dd class="num">{{ cart.subtotal | cop }}</dd>
              @if (cart.discount) { <dt>Descuento</dt><dd class="num">−{{ cart.discount | cop }}</dd> }
              <dt>IVA</dt><dd class="num">{{ cart.tax | cop }}</dd>
              <dt>Envío</dt><dd class="muted small">se calcula con tu dirección</dd>
              <dt class="big">Total</dt><dd class="num big">{{ cart.total | cop }}</dd>
            </dl>
            @if (cart.subtotal - cart.discount < cart.shipping_free_from) {
              <p class="muted small">Envío gratis desde {{ cart.shipping_free_from | cop }}.</p>
            } @else {
              <p class="small" style="color:var(--ok)">Tu pedido tiene envío gratis.</p>
            }
            <a class="btn btn-primary btn-block" routerLink="/checkout" [class.disabled]="!cart.can_checkout" [attr.aria-disabled]="!cart.can_checkout">Ir a pagar</a>
            @if (!cart.can_checkout) { <p class="field-error">Revisa los productos marcados antes de continuar.</p> }
          </aside>
        </div>
      }
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: `
    .item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 1rem; align-items: center; }
    .item.off { border-color: #f1c4bf; }
    .name { color: inherit; font-weight: 500; }
    .small { font-size: 0.8125rem; }
    .total { font-weight: 500; min-width: 6.5rem; text-align: right; }
    .sum { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem 1rem; margin: 0 0 1rem; }
    .sum dd { margin: 0; text-align: right; }
    .big { font-weight: 700; font-size: 1.125rem; border-top: 1px solid var(--line); padding-top: 0.5rem; }
    .btn.disabled { pointer-events: none; opacity: 0.45; }
    @media (max-width: 640px) { .item { grid-template-columns: 1fr auto; } .total { grid-column: 1; text-align: left; } }
  `,
})
export class Cart {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected store = inject(CartStore);
  protected busy = signal(false);
  protected code = '';

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
