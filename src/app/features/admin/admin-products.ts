import { Component, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Category, Paginated, Product, Variant } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

type ProductDraft = { name: string; category_id: number | null; description: string; is_active: boolean };
type VariantDraft = { sku: string; size: string; color: string; price: number | null; low_stock_threshold: number; is_active: boolean };

// Productos, variantes e imágenes en una sola pantalla: lista con filas expandibles.
@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, FormsModule, CopPipe],
  template: `
    <div class="page-head">
      <h1>Productos</h1>
      <div class="row">
        <input class="input" [(ngModel)]="q" (keyup.enter)="load()" placeholder="Buscar" aria-label="Buscar" style="width:220px" />
        <button type="button" class="btn btn-solid" (click)="openNew()">Nuevo producto</button>
      </div>
    </div>

    @if (draft(); as d) {
      <div class="card" style="margin-bottom:1.5rem">
        <h3>{{ editing()?.id ? 'Editar producto' : 'Nuevo producto' }}</h3>
        <div class="form-row">
          <div class="field"><label>Nombre</label><input class="input" [(ngModel)]="d.name" /></div>
          <div class="field"><label>Categoría</label>
            <select [(ngModel)]="d.category_id"><option [ngValue]="null" disabled>Elige…</option>@for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }</select>
          </div>
        </div>
        <div class="field"><label>Descripción</label><textarea rows="2" [(ngModel)]="d.description"></textarea></div>
        <label class="row" style="font-weight:400"><input type="checkbox" [(ngModel)]="d.is_active" /> Visible en la tienda</label>
        <div class="row" style="margin-top:1rem">
          <button type="button" class="btn btn-solid" (click)="saveProduct()" [disabled]="!d.name.trim() || !d.category_id || busy()">Guardar</button>
          <button type="button" class="btn btn-ghost" (click)="draft.set(null)">Cancelar</button>
        </div>
      </div>
    }

    @if (page(); as p) {
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Producto</th><th>Categoría</th><th class="num">Variantes</th><th class="num">Desde</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (prod of p.data; track prod.id) {
              <tr>
                <td class="thumb">@if (prod.image) { <img [src]="prod.image" alt="" /> } @else { <span class="ph"></span> }</td>
                <td><a [routerLink]="['/productos', prod.id]">{{ prod.name }}</a></td>
                <td>{{ prod.category?.name }}</td>
                <td class="num">{{ prod.variants?.length ?? 0 }}</td>
                <td class="num">{{ minPrice(prod) | cop }}</td>
                <td><span class="badge" [class.badge-ok]="prod.is_active">{{ prod.is_active ? 'Visible' : 'Oculto' }}</span></td>
                <td class="num" style="white-space:nowrap">
                  <button type="button" class="btn btn-sm btn-ghost" (click)="expanded.set(expanded() === prod.id ? null : prod.id)">{{ expanded() === prod.id ? 'Cerrar' : 'Variantes e imágenes' }}</button>
                  <button type="button" class="btn btn-sm btn-ghost" (click)="openEdit(prod)">Editar</button>
                  <button type="button" class="btn btn-sm btn-ghost" (click)="remove(prod)">Eliminar</button>
                </td>
              </tr>
              @if (expanded() === prod.id) {
                <tr><td colspan="7" class="detail">
                  <div class="detail-grid">
                    <section>
                      <h3>Variantes</h3>
                      <table class="inner">
                        <thead><tr><th>SKU</th><th>Talla</th><th>Color</th><th class="num">Precio</th><th class="num">Stock</th><th class="num">Reserv.</th><th class="num">Alerta</th><th></th></tr></thead>
                        <tbody>
                          @for (v of prod.variants; track v.id) {
                            <tr>
                              <td>{{ v.sku }}</td><td>{{ v.size }}</td><td>{{ v.color }}</td>
                              <td class="num">{{ v.price | cop }}</td><td class="num">{{ v.stock }}</td><td class="num">{{ v.reserved }}</td><td class="num">{{ v.low_stock_threshold }}</td>
                              <td class="num"><button type="button" class="btn btn-sm btn-ghost" (click)="openVariant(prod, v)">Editar</button></td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      @if (vdraft(); as vd) {
                        <div class="card" style="margin-top:1rem">
                          <h3>{{ vediting()?.id ? 'Editar variante' : 'Nueva variante' }}</h3>
                          <div class="vgrid">
                            <div class="field"><label>SKU</label><input class="input" [(ngModel)]="vd.sku" /></div>
                            <div class="field"><label>Talla</label><input class="input" [(ngModel)]="vd.size" /></div>
                            <div class="field"><label>Color</label><input class="input" [(ngModel)]="vd.color" /></div>
                            <div class="field"><label>Precio (COP)</label><input class="input" type="number" min="0" [(ngModel)]="vd.price" /></div>
                            <div class="field"><label>Alerta de stock bajo</label><input class="input" type="number" min="0" [(ngModel)]="vd.low_stock_threshold" /></div>
                            <label class="row" style="font-weight:400;align-self:end;margin-bottom:1rem"><input type="checkbox" [(ngModel)]="vd.is_active" /> Activa</label>
                          </div>
                          <div class="row">
                            <button type="button" class="btn btn-solid btn-sm" (click)="saveVariant(prod)" [disabled]="!vd.sku.trim() || vd.price === null || busy()">Guardar</button>
                            <button type="button" class="btn btn-ghost btn-sm" (click)="vdraft.set(null)">Cancelar</button>
                          </div>
                          <p class="muted small" style="margin-top:0.75rem">El stock se ajusta en <a routerLink="/admin/inventario">Inventario</a>.</p>
                        </div>
                      } @else {
                        <button type="button" class="btn btn-sm" style="margin-top:0.75rem" (click)="openVariant(prod)">Agregar variante</button>
                      }
                    </section>
                    <section>
                      <h3>Imágenes</h3>
                      <div class="imgs">
                        @for (img of prod.images; track img.id) {
                          <figure><img [src]="img.url" alt="" /><button type="button" class="btn btn-sm btn-ghost" (click)="deleteImage(prod, img.id)">Quitar</button></figure>
                        }
                      </div>
                      <label class="btn btn-sm" style="margin-top:0.75rem">
                        {{ uploading() ? 'Subiendo…' : 'Subir imagen' }}
                        <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="upload(prod, $event)" [disabled]="uploading()" />
                      </label>
                      <p class="muted small">JPG, PNG o WebP, máximo 4 MB. La primera es la principal.</p>
                    </section>
                  </div>
                </td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .thumb { width: 3.5rem; }
    .thumb img, .ph { width: 2.5rem; height: 3rem; object-fit: cover; border-radius: 2px; display: block; background: #e9ebe6; }
    .detail { background: var(--bg); }
    .detail-grid { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
    @media (min-width: 1000px) { .detail-grid { grid-template-columns: 2fr 1fr; } }
    .inner { font-size: 0.875rem; background: var(--surface); }
    .inner td:first-child { white-space: nowrap; }
    .vgrid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .imgs { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    figure { margin: 0; display: grid; gap: 0.25rem; justify-items: center; }
    figure img { width: 80px; height: 100px; object-fit: cover; border-radius: 2px; }
    .small { font-size: 0.8125rem; }
  `,
})
export class AdminProducts {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  page_ = input<string | number | undefined>(undefined, { alias: 'page' });
  protected q = '';
  protected page = signal<Paginated<Product> | null>(null);
  protected categories = signal<Category[]>([]);
  protected expanded = signal<number | null>(null);
  protected busy = signal(false);
  protected uploading = signal(false);
  protected draft = signal<ProductDraft | null>(null);
  protected editing = signal<Product | null>(null);
  protected vdraft = signal<VariantDraft | null>(null);
  protected vediting = signal<Variant | null>(null);

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    toObservable(this.page_).subscribe(() => this.load());
  }

  load() {
    this.api.products({ q: this.q || undefined, page: Number(this.page_() ?? 1), per_page: 50 }).subscribe((p) => this.page.set(p));
  }

  minPrice(p: Product) { return p.variants?.length ? Math.min(...p.variants.map((v) => v.price)) : 0; }

  openNew() { this.editing.set(null); this.draft.set({ name: '', category_id: null, description: '', is_active: true }); }
  openEdit(p: Product) { this.editing.set(p); this.draft.set({ name: p.name, category_id: p.category?.id ?? null, description: p.description ?? '', is_active: p.is_active }); }

  saveProduct() {
    const d = this.draft()!;
    this.busy.set(true);
    this.api.saveProduct({ name: d.name, category_id: d.category_id!, description: d.description || null, is_active: d.is_active }, this.editing()?.id).subscribe({
      next: () => { this.busy.set(false); this.draft.set(null); this.toast.ok('Producto guardado'); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  remove(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"? Dejará de verse en la tienda.`)) return;
    this.api.deleteProduct(p.id).subscribe({ next: () => { this.toast.ok('Producto eliminado'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }

  openVariant(p: Product, v?: Variant) {
    this.vediting.set(v ?? null);
    this.vdraft.set(v
      ? { sku: v.sku, size: v.size ?? '', color: v.color ?? '', price: v.price, low_stock_threshold: v.low_stock_threshold ?? 5, is_active: v.is_active }
      : { sku: '', size: '', color: '', price: null, low_stock_threshold: 5, is_active: true });
  }

  saveVariant(p: Product) {
    const d = this.vdraft()!;
    this.busy.set(true);
    const body = { sku: d.sku.trim(), size: d.size || null, color: d.color || null, price: d.price!, low_stock_threshold: d.low_stock_threshold, is_active: d.is_active };
    this.api.saveVariant(p.id, body, this.vediting()?.id).subscribe({
      next: () => { this.busy.set(false); this.vdraft.set(null); this.toast.ok('Variante guardada'); this.load(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  upload(p: Product, ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadProductImage(p.id, file, p.images.length).subscribe({
      next: () => { this.uploading.set(false); this.toast.ok('Imagen subida'); this.load(); },
      error: (e) => { this.uploading.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  deleteImage(p: Product, id: number) {
    this.api.deleteProductImage(id).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
  }
}
