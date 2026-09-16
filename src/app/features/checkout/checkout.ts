import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartStore } from '../../core/cart.store';
import { Address, ShippingQuote } from '../../core/models';
import { AddressForm } from '../../shared/address-form';
import { CopPipe, ToastService, errorMessage, uuid } from '../../shared/ui';

// Una sola pantalla: dirección → resumen con envío → "Confirmar y pagar".
// Crea la orden, inicia el pago y va a /checkout/result (fake) o redirige a la pasarela (Mercado Pago).
@Component({
  selector: 'app-checkout',
  imports: [RouterLink, AddressForm, CopPipe],
  template: `
    <div class="page-head"><h1>Finalizar compra</h1></div>
    @if (store.cart(); as cart) {
      @if (cart.items.length === 0) {
        <div class="empty"><h2>No hay nada que pagar</h2><a class="btn btn-solid" routerLink="/productos">Ir a la tienda</a></div>
      } @else {
        <div class="two-col">
          <section class="stack">
            <div class="card">
              <h2>Dirección de entrega</h2>
              @if (addresses().length && !showForm()) {
                <div class="stack">
                  @for (a of addresses(); track a.id) {
                    <label class="addr" [class.on]="selected()?.id === a.id">
                      <input type="radio" name="address" [checked]="selected()?.id === a.id" (change)="select(a)" />
                      <span>
                        <strong>{{ a.recipient }}</strong> · {{ a.phone }}<br />
                        {{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}, {{ a.city }}, {{ a.state }}
                      </span>
                    </label>
                  }
                </div>
                <button type="button" class="btn btn-ghost btn-sm" style="margin-top:0.75rem" (click)="showForm.set(true)">Usar otra dirección</button>
              } @else {
                <app-address-form (saved)="onSaved($event)" [cancellable]="addresses().length > 0" (cancelled)="showForm.set(false)" />
              }
            </div>

            <div class="card">
              <h2>Tu pedido</h2>
              <table>
                <tbody>
                  @for (i of cart.items; track i.id) {
                    <tr><td>{{ i.name }} <span class="muted">× {{ i.quantity }}</span></td><td class="num">{{ i.line_total | cop }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <aside class="card sticky">
            <h2>Total</h2>
            <dl class="sum">
              <dt>Subtotal</dt><dd class="num">{{ cart.subtotal | cop }}</dd>
              @if (cart.discount) { <dt>Descuento {{ cart.coupon?.code }}</dt><dd class="num">−{{ cart.discount | cop }}</dd> }
              <dt>IVA</dt><dd class="num">{{ cart.tax | cop }}</dd>
              <dt>Envío</dt>
              <dd class="num">
                @if (!selected()) { <span class="muted">elige dirección</span> }
                @else if (quote(); as q) { @if (q.shipping_cost === 0) { Gratis } @else { {{ q.shipping_cost | cop }} } }
                @else { … }
              </dd>
              <dt class="big">Total</dt><dd class="num big">{{ (quote()?.total ?? cart.total) | cop }}</dd>
            </dl>
            <button type="button" class="btn btn-primary btn-block" [disabled]="!selected() || !quote() || busy() || !cart.can_checkout" (click)="confirm()">
              {{ busy() ? 'Procesando…' : 'Confirmar y pagar' }}
            </button>
            <p class="muted small" style="margin-top:0.75rem">Reservamos tu pedido 30 minutos mientras completas el pago.</p>
          </aside>
        </div>
      }
    }
  `,
  styles: `
    .addr { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem; border: 1px solid var(--line); border-radius: var(--radius); cursor: pointer; font-weight: 400; }
    .addr.on { border-color: var(--indigo); background: #f4f5f9; }
    .addr input { margin-top: 0.3rem; }
    .sum { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem 1rem; margin: 0 0 1rem; }
    .sum dd { margin: 0; text-align: right; }
    .big { font-weight: 700; font-size: 1.125rem; border-top: 1px solid var(--line); padding-top: 0.5rem; }
    .small { font-size: 0.8125rem; }
  `,
})
export class Checkout {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected store = inject(CartStore);

  protected addresses = signal<Address[]>([]);
  protected selected = signal<Address | null>(null);
  protected showForm = signal(false);
  protected quote = signal<ShippingQuote | null>(null);
  protected busy = signal(false);

  constructor() {
    this.store.refresh();
    this.api.addresses().subscribe((list) => {
      this.addresses.set(list);
      if (list.length) this.select(list[0]); else this.showForm.set(true);
    });
    // Recotiza el envío cuando cambia la dirección o el carrito (cupón, cantidades).
    const key = computed(() => ({ address: this.selected()?.id, cartId: this.store.cart()?.id, total: this.store.cart()?.total, discount: this.store.cart()?.discount }));
    toObservable(key)
      .pipe(switchMap((k) => { this.quote.set(null); return k.address ? this.api.shippingQuote(k.address) : of(null); }))
      .subscribe((q) => this.quote.set(q));
  }

  select(a: Address) { this.selected.set(a); }

  onSaved(a: Address) {
    this.addresses.update((l) => [a, ...l]);
    this.select(a);
    this.showForm.set(false);
  }

  confirm() {
    this.busy.set(true);
    this.api.placeOrder(this.selected()!.id).subscribe({
      next: (order) => {
        this.store.refresh();
        this.api.pay(order.id, uuid()).subscribe({
          next: (payment) => {
            if (payment.checkout_url) { window.location.href = payment.checkout_url; return; }
            this.router.navigate(['/checkout/result'], { queryParams: { payment: payment.id } });
          },
          error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); this.router.navigate(['/pedidos', order.id]); },
        });
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); this.store.refresh(); },
    });
  }
}
