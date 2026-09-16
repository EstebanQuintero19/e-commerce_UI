import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { safeGatewayUrl } from '../../core/safe-url';
import { Payment } from '../../core/models';
import { CopPipe, PAYMENT_STATUS, ToastService, errorMessage } from '../../shared/ui';

/**
 * Se llega aquí de dos formas:
 *  - driver fake: ?payment=ID → botón para simular el pago (aprueba salvo total terminado en 99).
 *  - Mercado Pago: MP devuelve al cliente con ?external_reference=MP-ID&status=… → se consulta el pago hasta que deje de estar pendiente.
 */
@Component({
  selector: 'app-payment-result',
  imports: [RouterLink, CopPipe],
  template: `
    <div class="result">
      @if (payment(); as p) {
        @switch (p.status) {
          @case ('succeeded') {
            <div class="mark ok">✓</div>
            <h1>Pago aprobado</h1>
            <p>Tu pedido #{{ p.order_id }} por {{ p.amount | cop }} quedó confirmado. Te enviamos la factura al correo.</p>
          }
          @case ('failed') {
            <div class="mark err">✕</div>
            <h1>Pago rechazado</h1>
            <p>No se hizo ningún cobro y el pedido #{{ p.order_id }} se canceló. Puedes volver a intentarlo desde el carrito.</p>
          }
          @case ('pending') {
            <div class="mark">…</div>
            <h1>Pago pendiente</h1>
            @if (p.driver === 'fake') {
              <p>Entorno de pruebas: simula la respuesta de la pasarela.</p>
              <button type="button" class="btn btn-primary" (click)="confirmFake()" [disabled]="busy()">Simular pago de {{ p.amount | cop }}</button>
            } @else {
              <p>Estamos esperando la confirmación de la pasarela. Esta página se actualiza sola.</p>
              @if (gatewayUrl(p); as url) { <a class="btn" [href]="url" rel="noopener noreferrer">Volver a la pasarela</a> }
            }
          }
          @default {
            <h1>{{ statusLabel(p) }}</h1>
            <p>Revisa el detalle del pedido para más información.</p>
          }
        }
        <div class="row" style="justify-content:center;margin-top:1.5rem">
          <a class="btn btn-solid" [routerLink]="['/pedidos', p.order_id]">Ver pedido</a>
          <a class="btn btn-ghost" routerLink="/productos">Seguir comprando</a>
        </div>
      } @else if (error()) {
        <h1>No encontramos este pago</h1>
        <p class="muted">{{ error() }}</p>
        <a class="btn" routerLink="/pedidos">Ir a mis pedidos</a>
      } @else {
        <div class="sk" style="height:8rem" aria-busy="true"></div>
      }
    </div>
  `,
  styles: `
    .result { max-width: 560px; margin: 2rem auto; text-align: center; }
    .result p { margin-inline: auto; }
    .result { padding-block: 3rem; }
    .mark { width: 3.5rem; height: 3.5rem; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 1.25rem; font-size: 1.5rem; font-weight: 600; background: var(--wash); color: var(--ink-2); }
    .mark.ok { background: var(--ink); color: var(--paper); }
    .mark.err { background: var(--alert-soft); color: var(--alert); }
    @media (prefers-reduced-motion: no-preference) { .mark.ok { animation: pop 420ms var(--ease); } @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); } } }
  `,
})
export class PaymentResult {
  gatewayUrl(p: Payment) { return safeGatewayUrl(p.checkout_url); }
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroy = inject(DestroyRef);

  payment_ = input<string>(undefined, { alias: 'payment' });
  external_reference = input<string>();

  protected payment = signal<Payment | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    const id = computed(() => this.payment_() ?? this.external_reference()?.replace(/^MP-/, ''));
    toObservable(id).subscribe((v) => {
      if (!v) { this.error.set('Falta la referencia del pago.'); return; }
      this.load(Number(v));
    });
    this.destroy.onDestroy(() => clearTimeout(this.timer));
  }

  private load(id: number, attempt = 0) {
    this.api.payment(id).subscribe({
      next: (p) => {
        this.payment.set(p);
        // Mercado Pago confirma por webhook; se consulta cada 3 s hasta 2 min.
        if (p.status === 'pending' && p.driver !== 'fake' && attempt < 40) this.timer = setTimeout(() => this.load(id, attempt + 1), 3000);
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  statusLabel(p: Payment) { return PAYMENT_STATUS[p.status].label; }

  confirmFake() {
    this.busy.set(true);
    this.api.confirmFakePayment(this.payment()!.id).subscribe({
      next: (p) => { this.busy.set(false); this.payment.set(p); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
