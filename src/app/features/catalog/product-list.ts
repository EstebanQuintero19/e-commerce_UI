import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Category, Paginated, Product } from '../../core/models';
import { CopPipe } from '../../shared/ui';

@Component({
  selector: 'app-product-list',
  imports: [RouterLink, CopPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ title() }}</h1>
        @if (page(); as p) { <p class="muted">{{ p.meta.total }} {{ p.meta.total === 1 ? 'producto' : 'productos' }}</p> }
      </div>
    </div>

    <div class="chips" style="margin-bottom:1.5rem">
      <a class="chip" [class.on]="!category_id()" routerLink="/productos" [queryParams]="{ q: q() || null }">Todo</a>
      @for (c of categories(); track c.id) {
        <a class="chip" [class.on]="category_id() === c.id" routerLink="/productos" [queryParams]="{ category_id: c.id, q: q() || null }">{{ c.name }}</a>
      }
    </div>

    @if (loading()) {
      <p class="muted">Cargando…</p>
    } @else if (page()?.data?.length === 0) {
      <div class="empty">
        <h2>No encontramos nada</h2>
        <p>Prueba con otra palabra o quita el filtro de categoría.</p>
        <a class="btn" routerLink="/productos">Ver todo</a>
      </div>
    } @else if (page(); as p) {
      <div class="grid">
        @for (prod of p.data; track prod.id) {
          <a class="card-p" [routerLink]="['/productos', prod.id]">
            <div class="img">
              @if (prod.image) { <img [src]="prod.image" [alt]="prod.name" loading="lazy" /> } @else { <div class="ph">{{ prod.name.slice(0, 1) }}</div> }
            </div>
            <div class="body">
              <div class="name">{{ prod.name }}</div>
              <div class="muted small">{{ prod.category?.name }} · {{ sizes(prod) }}</div>
              <span class="tag">{{ price(prod) | cop }}</span>
            </div>
          </a>
        }
      </div>
      @if (p.meta.last_page > 1) {
        <div class="row between" style="margin-top:2rem">
          <a class="btn" [class.disabled]="p.meta.current_page === 1" routerLink="/productos" [queryParams]="params(p.meta.current_page - 1)">Anterior</a>
          <span class="muted">Página {{ p.meta.current_page }} de {{ p.meta.last_page }}</span>
          <a class="btn" routerLink="/productos" [queryParams]="params(p.meta.current_page + 1)">Siguiente</a>
        </div>
      }
    }
  `,
  styles: `
    .grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(2, 1fr); }
    @media (min-width: 700px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1000px) { .grid { grid-template-columns: repeat(4, 1fr); } }
    .card-p { display: block; text-decoration: none; color: inherit; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    .card-p:hover .name { text-decoration: underline; text-underline-offset: 3px; }
    .img { aspect-ratio: 4 / 5; background: #e9ebe6; }
    .img img { width: 100%; height: 100%; object-fit: cover; }
    .ph { width: 100%; height: 100%; display: grid; place-items: center; font-size: 3rem; font-weight: 700; color: #c5c9c0; }
    .body { padding: 0.9rem 1rem 1rem; display: grid; gap: 0.3rem; justify-items: start; }
    .name { font-weight: 500; }
    .small { font-size: 0.8125rem; }
    .btn.disabled { pointer-events: none; opacity: 0.4; }
  `,
})
export class ProductList {
  private api = inject(ApiService);
  private router = inject(Router);

  // Enlazados desde la query string (withComponentInputBinding).
  q = input<string>();
  category_id = input<number, string | number | undefined>(undefined as never, { transform: (v) => (v ? Number(v) : undefined) });
  page_ = input<string | number | undefined>(undefined, { alias: 'page' });

  protected categories = signal<Category[]>([]);
  protected page = signal<Paginated<Product> | null>(null);
  protected loading = signal(true);

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    const filters = computed(() => ({ q: this.q(), category_id: this.category_id(), page: Number(this.page_() ?? 1) }));
    toObservable(filters)
      .pipe(tap(() => this.loading.set(true)), switchMap((f) => this.api.products(f)))
      .subscribe({ next: (p) => { this.page.set(p); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  title() {
    const cat = this.categories().find((c) => c.id === this.category_id())?.name;
    if (this.q()) return `Resultados para “${this.q()}”`;
    return cat ?? 'Toda la tienda';
  }

  price(p: Product) {
    return Math.min(...(p.variants?.map((v) => v.price) ?? [0]));
  }

  sizes(p: Product) {
    return [...new Set(p.variants?.map((v) => v.size).filter(Boolean))].join(' ');
  }

  params(page: number) {
    return { q: this.q() || null, category_id: this.category_id() ?? null, page };
  }
}
