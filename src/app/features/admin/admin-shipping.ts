import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ShippingSettings } from '../../core/models';
import { STATES } from '../../shared/address-form';
import { ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-admin-shipping',
  imports: [FormsModule],
  template: `
    <div class="page-head"><h1>Envíos</h1></div>
    @if (s(); as s) {
      <div class="card" style="max-width:720px">
        <div class="form-row">
          <div class="field"><label>Tarifa por defecto (departamentos sin tarifa propia)</label><input class="input num" type="number" min="0" step="1000" [(ngModel)]="s.default" /></div>
          <div class="field"><label>Envío gratis desde (subtotal con descuento)</label><input class="input num" type="number" min="0" step="10000" [(ngModel)]="s.free_from" /></div>
        </div>
        <h3>Tarifa por departamento</h3>
        <div class="table-wrap" style="border-top:0">
          <table>
            <thead><tr><th>Departamento</th><th class="num">Costo</th><th></th></tr></thead>
            <tbody>
              @for (r of s.rates; track $index) {
                <tr>
                  <td><select [(ngModel)]="r.state">@for (st of states; track st) { <option [value]="st">{{ st }}</option> }</select></td>
                  <td class="num"><input class="input num" type="number" min="0" step="1000" [(ngModel)]="r.cost" style="width:9rem;margin-left:auto" /></td>
                  <td class="num"><button type="button" class="btn btn-sm btn-ghost" (click)="s.rates.splice($index, 1)">Quitar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="row" style="margin-top:1rem">
          <button type="button" class="btn btn-sm" (click)="add(s)">Agregar departamento</button>
        </div>
        <div class="row" style="margin-top:1.5rem">
          <button type="button" class="btn btn-solid" (click)="save(s)" [disabled]="busy()">Guardar cambios</button>
        </div>
      </div>
    } @else { <div class="sk" style="height:12rem" aria-busy="true"></div> }
  `,
})
export class AdminShipping {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected s = signal<ShippingSettings | null>(null);
  protected busy = signal(false);
  protected states = STATES;

  constructor() { this.api.shippingSettings().subscribe((s) => this.s.set(s)); }

  add(s: ShippingSettings) {
    const free = this.states.find((st) => !s.rates.some((r) => r.state === st)) ?? this.states[0];
    s.rates.push({ state: free, cost: s.default });
  }

  save(s: ShippingSettings) {
    this.busy.set(true);
    this.api.saveShippingSettings({ default: Number(s.default), free_from: Number(s.free_from), rates: s.rates.map((r) => ({ state: r.state, cost: Number(r.cost) })) }).subscribe({
      next: (r) => { this.busy.set(false); this.s.set(r); this.toast.ok('Tarifas guardadas'); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
