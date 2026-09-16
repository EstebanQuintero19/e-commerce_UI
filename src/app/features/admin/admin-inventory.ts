import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Product, Variant } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

interface Row { product: Product; variant: Variant; }
interface Movement { id: number; type: string; quantity: number; stock_after: number; reserved_after: number; reference: string | null; note: string | null; created_at: string; }

@Component({
  selector: 'app-admin-inventory',
  imports: [FormsModule, CopPipe, DatePipe],
  template: `
    <div class="page-head">
      <h1>Inventario</h1>
      <div class="row">
        <input class="input" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Producto o SKU" aria-label="Filtrar" style="width:220px" />
        <label class="row" style="font-weight:400"><input type="checkbox" [(ngModel)]="lowOnly" /> Solo stock bajo</label>
      </div>
    </div>

    @if (adjusting(); as r) {
      <div class="card" style="margin-bottom:1.5rem">
        <h3>Ajustar {{ r.product.name }} · {{ r.variant.sku }}</h3>
        <p class="muted">Stock {{ r.variant.stock }}, reservado {{ r.variant.reserved }}. Positivo entra, negativo sale; no puede quedar por debajo de lo reservado.</p>
        <div class="form-row">
          <div class="field"><label>Cantidad (±)</label><input class="input" type="number" [(ngModel)]="delta" /></div>
          <div class="field"><label>Motivo</label><input class="input" [(ngModel)]="note" placeholder="Ingreso proveedor, merma, conteo…" /></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-solid" (click)="adjust()" [disabled]="!delta || busy()">Aplicar</button>
          <button type="button" class="btn btn-ghost" (click)="adjusting.set(null)">Cancelar</button>
        </div>
      </div>
    }

    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>SKU</th><th>Talla / color</th><th class="num">Precio</th><th class="num">Stock</th><th class="num">Reservado</th><th class="num">Disponible</th><th></th></tr></thead>
        <tbody>
          @for (r of rows(); track r.variant.id) {
            <tr [class.low]="isLow(r.variant)">
              <td>{{ r.product.name }}</td>
              <td>{{ r.variant.sku }}</td>
              <td>{{ r.variant.size }} {{ r.variant.color }}</td>
              <td class="num">{{ r.variant.price | cop }}</td>
              <td class="num">{{ r.variant.stock }}</td>
              <td class="num">{{ r.variant.reserved }}</td>
              <td class="num"><strong>{{ r.variant.available }}</strong>@if (isLow(r.variant)) { <span class="badge badge-warn" style="margin-left:0.4rem">bajo</span> }</td>
              <td class="num" style="white-space:nowrap">
                <button type="button" class="btn btn-sm btn-ghost" (click)="openAdjust(r)">Ajustar</button>
                <button type="button" class="btn btn-sm btn-ghost" (click)="showMovements(r)">Movimientos</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="8" class="muted">Sin variantes que coincidan.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (movementsOf(); as r) {
      <div class="card" style="margin-top:1.5rem">
        <div class="row between"><h3>Movimientos · {{ r.variant.sku }}</h3><button type="button" class="btn btn-ghost btn-sm" (click)="movementsOf.set(null)">Cerrar</button></div>
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Stock</th><th class="num">Reserv.</th><th>Referencia</th><th>Nota</th></tr></thead>
          <tbody>
            @for (m of movements(); track m.id) {
              <tr><td>{{ m.created_at | date: 'd MMM y, h:mm a' }}</td><td>{{ types[m.type] ?? m.type }}</td><td class="num">{{ m.quantity }}</td><td class="num">{{ m.stock_after }}</td><td class="num">{{ m.reserved_after }}</td><td>{{ m.reference }}</td><td>{{ m.note }}</td></tr>
            } @empty { <tr><td colspan="7" class="muted">Sin movimientos.</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `tr.low td { background: var(--warn-soft); }`,
})
export class AdminInventory {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  protected q = signal('');
  protected lowOnly = false;
  protected all = signal<Row[]>([]);
  protected adjusting = signal<Row | null>(null);
  protected movementsOf = signal<Row | null>(null);
  protected movements = signal<Movement[]>([]);
  protected busy = signal(false);
  protected delta: number | null = null;
  protected note = '';
  protected types: Record<string, string> = { reserve: 'Reserva', release: 'Liberación', commit: 'Venta', adjust: 'Ajuste' };

  // La búsqueda (nombre o SKU) la hace la API; "solo bajo stock" se filtra sobre lo recibido.
  protected rows = computed(() => this.all().filter((r) => !this.lowOnly || this.isLow(r.variant)));

  constructor() {
    toObservable(this.q).pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => this.load());
  }

  private load() {
    this.api.products({ q: this.q().trim() || undefined, per_page: 100 }).subscribe((p) => {
      this.all.set(p.data.flatMap((product) => (product.variants ?? []).map((variant) => ({ product, variant }))));
    });
  }

  isLow(v: Variant) { return v.available <= (v.low_stock_threshold ?? 0); }

  openAdjust(r: Row) { this.adjusting.set(r); this.delta = null; this.note = ''; }

  adjust() {
    const r = this.adjusting()!;
    this.busy.set(true);
    this.api.adjustStock(r.variant.id, this.delta!, this.note || undefined).subscribe({
      next: () => { this.busy.set(false); this.adjusting.set(null); this.toast.ok('Stock actualizado'); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  showMovements(r: Row) {
    this.movementsOf.set(r);
    this.http.get<{ data: Movement[] }>(`${environment.apiUrl}/variants/${r.variant.id}/movements`).subscribe((res) => this.movements.set(res.data));
  }
}
