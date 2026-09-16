import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Coupon, CouponInput } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-admin-coupons',
  imports: [FormsModule, CopPipe, DatePipe],
  template: `
    <div class="page-head"><h1>Cupones</h1><button type="button" class="btn btn-solid" (click)="openNew()">Nuevo cupón</button></div>

    @if (draft(); as d) {
      <div class="card" style="margin-bottom:1.5rem">
        <h3>{{ editing()?.id ? 'Editar ' + editing()!.code : 'Nuevo cupón' }}</h3>
        <div class="grid">
          <div class="field"><label>Código</label><input class="input" [(ngModel)]="d.code" placeholder="BIENVENIDO10" [disabled]="!!editing()" /></div>
          <div class="field"><label>Tipo</label><select [(ngModel)]="d.type"><option value="percent">Porcentaje</option><option value="fixed">Monto fijo (COP)</option></select></div>
          <div class="field"><label>{{ d.type === 'percent' ? 'Porcentaje' : 'Monto' }}</label><input class="input" type="number" min="1" [(ngModel)]="d.value" /></div>
          <div class="field"><label>Subtotal mínimo</label><input class="input" type="number" min="0" [(ngModel)]="d.min_subtotal" /></div>
          <div class="field"><label>Usos máximos (vacío = sin límite)</label><input class="input" type="number" min="1" [(ngModel)]="d.max_uses" /></div>
          <div class="field"><label>Vence el</label><input class="input" type="date" [(ngModel)]="d.expires_at" /></div>
        </div>
        <label class="row" style="font-weight:400"><input type="checkbox" [(ngModel)]="d.is_active" /> Activo</label>
        <div class="row" style="margin-top:1rem">
          <button type="button" class="btn btn-solid" (click)="save()" [disabled]="!d.code.trim() || !d.value || busy()">Guardar</button>
          <button type="button" class="btn btn-ghost" (click)="draft.set(null)">Cancelar</button>
        </div>
      </div>
    }

    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Descuento</th><th class="num">Mínimo</th><th class="num">Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (c of coupons(); track c.id) {
            <tr>
              <td><strong>{{ c.code }}</strong></td>
              <td>{{ c.type === 'percent' ? c.value + ' %' : (c.value | cop) }}</td>
              <td class="num">{{ c.min_subtotal ? (c.min_subtotal | cop) : '—' }}</td>
              <td class="num">{{ c.uses }}{{ c.max_uses ? ' / ' + c.max_uses : '' }}</td>
              <td>{{ c.expires_at ? (c.expires_at | date: 'd MMM y') : 'No vence' }}</td>
              <td><span class="badge" [class.badge-ok]="c.is_active">{{ c.is_active ? 'Activo' : 'Inactivo' }}</span></td>
              <td class="num" style="white-space:nowrap">
                <button type="button" class="btn btn-sm btn-ghost" (click)="openEdit(c)">Editar</button>
                <button type="button" class="btn btn-sm btn-ghost" (click)="remove(c)">Eliminar</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="7" class="muted">Aún no hay cupones.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
  styles: `.grid { display: grid; gap: 0.75rem 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }`,
})
export class AdminCoupons {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected coupons = signal<Coupon[]>([]);
  protected draft = signal<(CouponInput & { expires_at: string }) | null>(null);
  protected editing = signal<Coupon | null>(null);
  protected busy = signal(false);

  constructor() { this.load(); }

  private load() { this.api.coupons().subscribe((r) => this.coupons.set(r.data)); }

  openNew() { this.editing.set(null); this.draft.set({ code: '', type: 'percent', value: 10, min_subtotal: 0, max_uses: null, expires_at: '', is_active: true }); }
  openEdit(c: Coupon) { this.editing.set(c); this.draft.set({ ...c, expires_at: c.expires_at?.slice(0, 10) ?? '' }); }

  save() {
    const d = this.draft()!;
    const body: Partial<CouponInput> = { type: d.type, value: d.value, min_subtotal: d.min_subtotal ?? 0, max_uses: d.max_uses || null, expires_at: d.expires_at || null, is_active: d.is_active };
    if (!this.editing()) body.code = d.code;
    this.busy.set(true);
    this.api.saveCoupon(body, this.editing()?.id).subscribe({
      next: () => { this.busy.set(false); this.draft.set(null); this.toast.ok('Cupón guardado'); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  remove(c: Coupon) {
    if (!confirm(`¿Eliminar el cupón ${c.code}?`)) return;
    this.api.deleteCoupon(c.id).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
  }
}
