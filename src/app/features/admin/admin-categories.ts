import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Category } from '../../core/models';
import { ToastService, errorMessage } from '../../shared/ui';

type Draft = { name: string; parent_id: number | null; is_active: boolean };

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <h1>Categorías</h1>
      <button type="button" class="btn btn-solid" (click)="openNew()">Nueva categoría</button>
    </div>
    <p class="muted">Dos niveles: una categoría madre (Camisetas) y sus subcategorías (Polos, Básicas…). Los productos se asignan a la subcategoría.</p>

    @if (draft(); as d) {
      <div class="card" style="margin-bottom:1.5rem">
        <h3>{{ editing()?.id ? 'Editar categoría' : 'Nueva categoría' }}</h3>
        <div class="form-row">
          <div class="field"><label>Nombre</label><input class="input" [(ngModel)]="d.name" /></div>
          <div class="field"><label>Categoría madre</label>
            <select [(ngModel)]="d.parent_id">
              <option [ngValue]="null">Ninguna (es una categoría madre)</option>
              @for (c of roots(); track c.id) { @if (c.id !== editing()?.id) { <option [ngValue]="c.id">{{ c.name }}</option> } }
            </select>
          </div>
        </div>
        <label class="row" style="font-weight:400"><input type="checkbox" [(ngModel)]="d.is_active" /> Visible en la tienda</label>
        <div class="row" style="margin-top:1rem">
          <button type="button" class="btn btn-solid" (click)="save()" [disabled]="!d.name.trim() || busy()">Guardar</button>
          <button type="button" class="btn btn-ghost" (click)="draft.set(null)">Cancelar</button>
        </div>
      </div>
    }

    <div class="table-wrap">
      <table>
        <thead><tr><th>Categoría</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (c of roots(); track c.id) {
            <tr><td><strong>{{ c.name }}</strong></td><td><span class="badge" [class.badge-ok]="c.is_active">{{ c.is_active ? 'Visible' : 'Oculta' }}</span></td>
              <td class="num"><button type="button" class="btn btn-sm btn-ghost" (click)="openEdit(c)">Editar</button><button type="button" class="btn btn-sm btn-ghost" (click)="remove(c)">Eliminar</button></td></tr>
            @for (s of childrenOf(c.id); track s.id) {
              <tr><td style="padding-left:2rem">{{ s.name }}</td><td><span class="badge" [class.badge-ok]="s.is_active">{{ s.is_active ? 'Visible' : 'Oculta' }}</span></td>
                <td class="num"><button type="button" class="btn btn-sm btn-ghost" (click)="openEdit(s)">Editar</button><button type="button" class="btn btn-sm btn-ghost" (click)="remove(s)">Eliminar</button></td></tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminCategories {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected categories = signal<Category[]>([]);
  protected roots = computed(() => this.categories().filter((c) => !c.parent_id));
  protected draft = signal<Draft | null>(null);
  protected editing = signal<Category | null>(null);
  protected busy = signal(false);

  constructor() { this.load(); }

  childrenOf(id: number) { return this.categories().filter((c) => c.parent_id === id); }
  private load() { this.api.invalidateCatalog(); this.api.categories().subscribe((c) => this.categories.set(c)); }

  openNew() { this.editing.set(null); this.draft.set({ name: '', parent_id: null, is_active: true }); }
  openEdit(c: Category) { this.editing.set(c); this.draft.set({ name: c.name, parent_id: c.parent_id, is_active: c.is_active }); }

  save() {
    const d = this.draft()!;
    this.busy.set(true);
    this.api.saveCategory({ name: d.name, parent_id: d.parent_id, is_active: d.is_active } as Partial<Category>, this.editing()?.id).subscribe({
      next: () => { this.busy.set(false); this.draft.set(null); this.toast.ok('Categoría guardada'); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  remove(c: Category) {
    if (!confirm(`¿Eliminar "${c.name}"? Los productos quedarán sin categoría visible.`)) return;
    this.api.deleteCategory(c.id).subscribe({ next: () => { this.toast.ok('Categoría eliminada'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
}
