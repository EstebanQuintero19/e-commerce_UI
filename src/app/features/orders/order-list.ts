import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Order, Paginated } from '../../core/models';
import { CopPipe, ORDER_STATUS } from '../../shared/ui';
import { PageMeta } from '../../shared/seo';
import { ErrorState } from '../../shared/error-state';

@Component({
  selector: 'app-order-list',
  imports: [RouterLink, CopPipe, DatePipe, ErrorState],
  template: `
    <div class="page-head"><h1>Mis pedidos</h1></div>
    @if (page(); as p) {
      @if (p.data.length === 0) {
        <div class="empty"><h2>Aún no tienes pedidos</h2><a class="btn btn-solid" routerLink="/productos">Ir a la tienda</a></div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th class="num">Total</th><th></th></tr></thead>
            <tbody>
              @for (o of p.data; track o.id) {
                <tr>
                  <td><a [routerLink]="['/pedidos', o.id]">#{{ o.id }}</a></td>
                  <td>{{ o.created_at | date: 'd MMM y' }}</td>
                  <td><span class="badge" [class]="'badge ' + status[o.status].badge">{{ status[o.status].label }}</span></td>
                  <td class="num">{{ o.total | cop }}</td>
                  <td class="num">
                    @if (o.status === 'pending') { <a class="btn btn-primary btn-sm" [routerLink]="['/pedidos', o.id]">Pagar</a> }
                    @else { <a class="btn btn-ghost btn-sm" [routerLink]="['/pedidos', o.id]">Ver</a> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (p.meta.last_page > 1) {
          <div class="row between" style="margin-top:1.5rem">
            <a class="btn" routerLink="/pedidos" [queryParams]="{ page: p.meta.current_page - 1 }" [class.disabled]="p.meta.current_page === 1">Anterior</a>
            <span class="muted">Página {{ p.meta.current_page }} de {{ p.meta.last_page }}</span>
            <a class="btn" routerLink="/pedidos" [queryParams]="{ page: p.meta.current_page + 1 }" [class.disabled]="p.meta.current_page === p.meta.last_page">Siguiente</a>
          </div>
        }
      }
    } @else if (error()) { <app-error-state (retry)="retry()" /> }
    @else { <div class="sk" style="height:10rem" aria-busy="true"></div> }
  `,
  styles: `.btn.disabled { pointer-events: none; opacity: 0.4; }`,
})
export class OrderList {
  private api = inject(ApiService);
  page_ = input<string | number | undefined>(undefined, { alias: 'page' });
  protected page = signal<Paginated<Order> | null>(null);
  protected error = signal(false);
  private attempt = signal(0);
  protected status = ORDER_STATUS;

  constructor() {
    inject(PageMeta).set('Mis pedidos');
    toObservable(computed(() => [this.page_(), this.attempt()] as const))
      .pipe(
        tap(() => { this.page.set(null); this.error.set(false); }),
        switchMap(([page]) => this.api.orders({ page: Number(page ?? 1) }).pipe(catchError(() => { this.error.set(true); return EMPTY; }))),
      )
      .subscribe((p) => this.page.set(p));
  }

  retry() { this.attempt.update((n) => n + 1); }
}
