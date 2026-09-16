import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Invoice } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-invoice-list',
  imports: [RouterLink, CopPipe, DatePipe],
  template: `
    <div class="page-head"><h1>Mis facturas</h1></div>
    @if (invoices(); as list) {
      @if (list.length === 0) {
        <div class="empty"><h2>Todavía no hay facturas</h2><p>Se emiten automáticamente cuando un pedido queda pagado.</p><a class="btn" routerLink="/pedidos">Ver pedidos</a></div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead><tr><th>Factura</th><th>Fecha</th><th>Pedido</th><th class="num">Total</th><th></th></tr></thead>
            <tbody>
              @for (i of list; track i.id) {
                <tr>
                  <td><strong>{{ i.number }}</strong></td>
                  <td>{{ i.issued_at | date: 'd MMM y' }}</td>
                  <td><a [routerLink]="['/pedidos', i.order_id]">#{{ i.order_id }}</a></td>
                  <td class="num">{{ i.total | cop }}</td>
                  <td class="num"><button type="button" class="btn btn-sm" (click)="pdf(i)">Ver PDF</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else { <p class="muted">Cargando…</p> }
  `,
})
export class InvoiceList {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected invoices = signal<Invoice[] | null>(null);

  constructor() {
    this.api.invoices().subscribe((r) => this.invoices.set(r.data));
  }

  pdf(i: Invoice) {
    this.api.invoicePdf(i.id).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
