import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Invoice, Order, Payment } from '../../core/models';
import { CopPipe, ORDER_STATUS, PAYMENT_STATUS, ToastService, errorMessage, uuid } from '../../shared/ui';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, FormsModule, CopPipe, DatePipe],
  template: `
    @if (order(); as o) {
      <p><a routerLink="/pedidos">Mis pedidos</a></p>
      <div class="page-head">
        <div>
          <h1>Pedido #{{ o.id }}</h1>
          <span class="badge" [class]="'badge ' + status[o.status].badge">{{ status[o.status].label }}</span>
          <span class="muted"> · {{ o.created_at | date: 'd MMM y, h:mm a' }}</span>
        </div>
        <div class="row">
          @if (o.status === 'pending') {
            <button type="button" class="btn btn-primary" (click)="pay()" [disabled]="busy()">Pagar {{ o.total | cop }}</button>
            <button type="button" class="btn btn-ghost" (click)="cancel()" [disabled]="busy()">Cancelar pedido</button>
          }
          @if (invoice(); as inv) { <button type="button" class="btn" (click)="pdf(inv)">Factura {{ inv.number }}</button> }
          @if (canReturn(o)) { <button type="button" class="btn btn-ghost" (click)="returnOpen.set(!returnOpen())">Solicitar devolución</button> }
        </div>
      </div>

      @if (o.status === 'pending') {
        <div class="alert alert-info">Tu pedido está reservado. Si no se paga en 30 minutos se cancela y las unidades vuelven a la tienda.</div>
      }
      @if (returnOpen()) {
        <div class="card" style="margin-bottom:1.5rem">
          <h2>Devolución</h2>
          <p class="muted">Cuéntanos qué pasó. Revisamos la solicitud y te avisamos por correo.</p>
          <textarea rows="3" [(ngModel)]="reason" placeholder="Motivo"></textarea>
          <div class="row" style="margin-top:0.75rem">
            <button type="button" class="btn btn-solid" (click)="requestReturn()" [disabled]="!reason.trim() || busy()">Enviar solicitud</button>
            <button type="button" class="btn btn-ghost" (click)="returnOpen.set(false)">Cancelar</button>
          </div>
        </div>
      }
      @if (o.return; as r) {
        <div class="card" style="margin-bottom:1.5rem">
          <h3>Devolución</h3>
          <p>{{ r.reason }}</p>
          <p class="muted small">Solicitada el {{ r.requested_at | date: 'd MMM y' }}@if (r.refunded_at) { · reembolsada el {{ r.refunded_at | date: 'd MMM y' }}}</p>
        </div>
      }

      <div class="two-col">
        <section class="stack">
          <div class="card">
            <table>
              <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Total</th></tr></thead>
              <tbody>
                @for (i of o.items; track i.id) {
                  <tr><td>{{ i.name }}<div class="muted small">{{ i.sku }}</div></td><td class="num">{{ i.quantity }}</td><td class="num">{{ i.unit_price | cop }}</td><td class="num">{{ i.line_total | cop }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (o.shipment; as s) {
            <div class="card">
              <h3>Envío</h3>
              <p>{{ s.carrier }} · guía <strong>{{ s.tracking_number }}</strong><br />
                <span class="muted small">Despachado el {{ s.shipped_at | date: 'd MMM y' }}@if (s.delivered_at) { · entregado el {{ s.delivered_at | date: 'd MMM y' }}}</span></p>
            </div>
          }
          @if (payments().length) {
            <div class="card">
              <h3>Pagos</h3>
              @for (p of payments(); track p.id) {
                <div class="row between"><span>{{ p.amount | cop }} · {{ p.driver }}</span><span class="badge" [class]="'badge ' + pstatus[p.status].badge">{{ pstatus[p.status].label }}</span></div>
              }
            </div>
          }
        </section>
        <aside class="card">
          <h3>Entrega</h3>
          <p>{{ o.shipping_address.recipient }} · {{ o.shipping_address.phone }}<br />
            {{ o.shipping_address.line1 }}@if (o.shipping_address.line2) {, {{ o.shipping_address.line2 }}}<br />{{ o.shipping_address.city }}, {{ o.shipping_address.state }}</p>
          <h3>Totales</h3>
          <dl class="sum">
            <dt>Subtotal</dt><dd class="num">{{ o.subtotal | cop }}</dd>
            @if (o.discount) { <dt>Descuento {{ o.coupon_code }}</dt><dd class="num">−{{ o.discount | cop }}</dd> }
            <dt>IVA</dt><dd class="num">{{ o.tax | cop }}</dd>
            <dt>Envío</dt><dd class="num">{{ o.shipping_cost ? (o.shipping_cost | cop) : 'Gratis' }}</dd>
            <dt class="big">Total</dt><dd class="num big">{{ o.total | cop }}</dd>
          </dl>
        </aside>
      </div>
    } @else { <p class="muted">Cargando…</p> }
  `,
  styles: `
    .sum { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem 1rem; margin: 0; }
    .sum dd { margin: 0; text-align: right; }
    .big { font-weight: 700; border-top: 1px solid var(--line); padding-top: 0.5rem; }
    .small { font-size: 0.8125rem; }
    h3 { margin-top: 0.5rem; }
  `,
})
export class OrderDetail {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  id = input.required<string>();
  protected order = signal<Order | null>(null);
  protected payments = signal<Payment[]>([]);
  protected invoice = signal<Invoice | null>(null);
  protected busy = signal(false);
  protected returnOpen = signal(false);
  protected reason = '';
  protected status = ORDER_STATUS;
  protected pstatus = PAYMENT_STATUS;

  constructor() {
    toObservable(this.id).subscribe(() => this.load());
  }

  private load() {
    const id = Number(this.id());
    this.api.order(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.api.paymentsOf(id).subscribe((p) => this.payments.set(p));
        if (!['pending', 'cancelled'].includes(o.status)) {
          this.api.invoices().subscribe((r) => this.invoice.set(r.data.find((i) => i.order_id === id) ?? null));
        }
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/pedidos']); },
    });
  }

  canReturn(o: Order) { return ['paid', 'shipped', 'delivered'].includes(o.status) && !this.auth.isAdmin(); }

  pay() {
    const o = this.order()!;
    const pending = this.payments().find((p) => p.status === 'pending');
    if (pending) { this.goToPayment(pending); return; }
    this.busy.set(true);
    this.api.pay(o.id, uuid()).subscribe({
      next: (p) => this.goToPayment(p),
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  private goToPayment(p: Payment) {
    if (p.checkout_url) { window.location.href = p.checkout_url; return; }
    this.router.navigate(['/checkout/result'], { queryParams: { payment: p.id } });
  }

  cancel() {
    this.busy.set(true);
    this.api.cancelOrder(this.order()!.id).subscribe({
      next: (o) => { this.busy.set(false); this.order.set(o); this.toast.ok('Pedido cancelado'); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  requestReturn() {
    this.busy.set(true);
    this.api.requestReturn(this.order()!.id, this.reason.trim()).subscribe({
      next: (o) => { this.busy.set(false); this.order.set(o); this.returnOpen.set(false); this.toast.ok('Solicitud enviada'); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  pdf(inv: Invoice) {
    this.api.invoicePdf(inv.id).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
