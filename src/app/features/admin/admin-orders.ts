import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Order, OrderStatus, Paginated } from '../../core/models';
import { CopPipe, ORDER_STATUS, ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink, FormsModule, CopPipe, DatePipe],
  template: `
    <div class="page-head">
      <h1>Pedidos</h1>
      <div class="chips">
        @for (s of filters; track s.value) {
          <a class="chip" [class.on]="(status() ?? '') === s.value" routerLink="/admin/pedidos" [queryParams]="{ status: s.value || null }">{{ s.label }}</a>
        }
      </div>
    </div>

    @if (shipping(); as o) {
      <div class="card" style="margin-bottom:1.5rem">
        <h3>Despachar pedido #{{ o.id }}</h3>
        <div class="form-row">
          <div class="field"><label>Transportadora</label><input class="input" [(ngModel)]="carrier" placeholder="Servientrega, Coordinadora…" /></div>
          <div class="field"><label>Número de guía</label><input class="input" [(ngModel)]="tracking" /></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-solid" (click)="ship()" [disabled]="!carrier.trim() || !tracking.trim() || busy()">Marcar como enviado</button>
          <button type="button" class="btn btn-ghost" (click)="shipping.set(null)">Cancelar</button>
        </div>
      </div>
    }

    @if (page(); as p) {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th class="num">Total</th><th></th></tr></thead>
          <tbody>
            @for (o of p.data; track o.id) {
              <tr>
                <td><a [routerLink]="['/pedidos', o.id]">#{{ o.id }}</a></td>
                <td>{{ o.shipping_address.recipient }}<div class="muted small">{{ o.shipping_address.city }}</div></td>
                <td>{{ o.created_at | date: 'd MMM, h:mm a' }}</td>
                <td>
                  <span class="badge" [class]="'badge ' + st[o.status].badge">{{ st[o.status].label }}</span>
                  @if (o.shipment) { <div class="muted small">{{ o.shipment.carrier }} {{ o.shipment.tracking_number }}</div> }
                  @if (o.return) { <div class="muted small">“{{ o.return.reason }}”</div> }
                </td>
                <td class="num">{{ o.total | cop }}</td>
                <td class="num actions">
                  @switch (o.status) {
                    @case ('paid') { <button type="button" class="btn btn-sm btn-solid" (click)="shipping.set(o)">Despachar</button> }
                    @case ('shipped') { <button type="button" class="btn btn-sm" (click)="deliver(o)" [disabled]="busy()">Entregado</button> }
                    @case ('return_requested') {
                      <button type="button" class="btn btn-sm btn-danger" (click)="refund(o)" [disabled]="busy()">Reembolsar</button>
                      <button type="button" class="btn btn-sm btn-ghost" (click)="rejectReturn(o)" [disabled]="busy()">Rechazar</button>
                    }
                    @case ('delivered') { <button type="button" class="btn btn-sm btn-ghost" (click)="refund(o)" [disabled]="busy()">Reembolsar</button> }
                  }
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="muted">No hay pedidos con este estado.</td></tr> }
          </tbody>
        </table>
      </div>
      @if (p.meta.last_page > 1) {
        <div class="row between" style="margin-top:1rem">
          <a class="btn btn-sm" routerLink="/admin/pedidos" [queryParams]="{ status: status() || null, page: p.meta.current_page - 1 }" [class.disabled]="p.meta.current_page === 1">Anterior</a>
          <span class="muted">{{ p.meta.current_page }} / {{ p.meta.last_page }}</span>
          <a class="btn btn-sm" routerLink="/admin/pedidos" [queryParams]="{ status: status() || null, page: p.meta.current_page + 1 }" [class.disabled]="p.meta.current_page === p.meta.last_page">Siguiente</a>
        </div>
      }
    }
  `,
  styles: `
    .small { font-size: 0.8125rem; }
    .actions { white-space: nowrap; }
    .actions .btn + .btn { margin-left: 0.25rem; }
    .btn.disabled { pointer-events: none; opacity: 0.4; }
  `,
})
export class AdminOrders {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  status = input<OrderStatus | undefined>();
  page_ = input<string | number | undefined>(undefined, { alias: 'page' });

  protected page = signal<Paginated<Order> | null>(null);
  protected shipping = signal<Order | null>(null);
  protected busy = signal(false);
  protected carrier = '';
  protected tracking = '';
  protected st = ORDER_STATUS;
  protected filters = [{ value: '', label: 'Todos' }, ...(Object.keys(ORDER_STATUS) as OrderStatus[]).map((k) => ({ value: k, label: ORDER_STATUS[k].label }))];

  constructor() {
    toObservable(computed(() => [this.status(), this.page_()])).subscribe(() => this.load());
  }

  private load() {
    this.api.orders({ status: this.status() || undefined, page: Number(this.page_() ?? 1) }).subscribe((p) => this.page.set(p));
  }

  private run<T>(op: import('rxjs').Observable<T>, ok: string) {
    this.busy.set(true);
    op.subscribe({
      next: () => { this.busy.set(false); this.toast.ok(ok); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  ship() {
    const o = this.shipping()!;
    this.run(this.api.shipOrder(o.id, this.carrier.trim(), this.tracking.trim()), `Pedido #${o.id} enviado`);
    this.shipping.set(null);
    this.carrier = this.tracking = '';
  }
  deliver(o: Order) { this.run(this.api.deliverOrder(o.id), `Pedido #${o.id} entregado`); }
  rejectReturn(o: Order) { this.run(this.api.rejectReturn(o.id), 'Devolución rechazada'); }

  refund(o: Order) {
    if (!confirm(`¿Reembolsar ${o.total.toLocaleString('es-CO')} del pedido #${o.id}? El stock vuelve al inventario.`)) return;
    this.busy.set(true);
    this.api.paymentsOf(o.id).subscribe((payments) => {
      const p = payments.find((x) => x.status === 'succeeded' || x.status === 'refund_required');
      if (!p) { this.busy.set(false); this.toast.error('El pedido no tiene un pago aprobado'); return; }
      this.run(this.api.refundPayment(p.id), `Pedido #${o.id} reembolsado`);
    });
  }
}
