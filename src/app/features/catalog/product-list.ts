import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Category, Gender, Paginated, Product, ProductFilters, ProductSort } from '../../core/models';
import { ProductCard } from '../../shared/product-card';
import { swatch } from '../../shared/product-image';
import { PageMeta } from '../../shared/seo';
import { CopPipe, GENDER_LABEL } from '../../shared/ui';
import { ErrorState } from '../../shared/error-state';

@Component({
  selector: 'app-product-list',
  imports: [RouterLink, ProductCard, ErrorState],
  template: `
    <nav class="crumbs" aria-label="Estás en">
      <a routerLink="/">Inicio</a>
      @if (gender()) { <span>/</span><a routerLink="/productos" [queryParams]="{ gender: gender() }">{{ genderLabel[gender()!] }}</a> }
      @if (parent(); as p) { <span>/</span><a routerLink="/productos" [queryParams]="params({ category_id: p.id, page: null })">{{ p.name }}</a> }
      @if (category(); as c) { @if (c.id !== parent()?.id) { <span>/</span><span>{{ c.name }}</span> } }
    </nav>

    <div class="bar">
      <div class="bar-title">
        <h1>{{ title() }}</h1>
        @if (page(); as p) { <span class="muted">{{ p.meta.total }} {{ p.meta.total === 1 ? 'artículo' : 'artículos' }}</span> }
      </div>
      <nav class="bar-cats" aria-label="Categoría">
        @if (parent(); as p) {
          <a [class.on]="category_id() === p.id" routerLink="/productos" [queryParams]="params({ category_id: p.id, page: null })">Todo en {{ p.name }}</a>
          @for (c of childrenOf(p.id); track c.id) {
            <a [class.on]="category_id() === c.id" routerLink="/productos" [queryParams]="params({ category_id: c.id, page: null })">{{ c.name }}</a>
          }
        } @else {
          <a [class.on]="!category_id()" routerLink="/productos" [queryParams]="params({ category_id: null, page: null })">Todo</a>
          @for (c of roots(); track c.id) {
            <a routerLink="/productos" [queryParams]="params({ category_id: c.id, page: null })">{{ c.name }}</a>
          }
        }
      </nav>
    </div>

    <div class="filters">
      <div class="tabs">
        <a [class.on]="!gender() && !badge()" routerLink="/productos" [queryParams]="params({ gender: null, badge: null, page: null })">Todo</a>
        <a [class.on]="gender() === 'mujer'" routerLink="/productos" [queryParams]="params({ gender: 'mujer', badge: null, page: null })">Mujer</a>
        <a [class.on]="gender() === 'hombre'" routerLink="/productos" [queryParams]="params({ gender: 'hombre', badge: null, page: null })">Hombre</a>
        <a [class.on]="badge() === 'Nuevo'" routerLink="/productos" [queryParams]="params({ gender: null, badge: 'Nuevo', page: null })">Novedades</a>
      </div>
      <div class="tools">
        <button type="button" class="ftr-btn" [class.on]="open()" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          Filtros @if (activeCount()) { <span class="n">{{ activeCount() }}</span> }
        </button>
        <label class="sort">
          <span class="muted">Ordenar</span>
          <select [value]="sort() ?? 'newest'" (change)="setSort($any($event.target).value)">
            <option value="newest">Novedades</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="name">Nombre</option>
          </select>
        </label>
      </div>
    </div>

    @if (open() && facets(); as f) {
      <div class="panel">
        <div class="group">
          <span class="group-title">Talla</span>
          <div class="chips">
            @for (s of f.sizes; track s) { <a class="chip" [class.on]="size() === s" routerLink="/productos" [queryParams]="params({ size: size() === s ? null : s, page: null })">{{ s }}</a> }
          </div>
        </div>
        <div class="group">
          <span class="group-title">Color</span>
          <div class="colors">
            @for (c of f.colors; track c) {
              <a class="color" [class.on]="color() === c" routerLink="/productos" [queryParams]="params({ color: color() === c ? null : c, page: null })" [title]="c">
                <i [style.background]="swatch(c)"></i><span>{{ c }}</span>
              </a>
            }
          </div>
        </div>
        <div class="group">
          <span class="group-title">Precio</span>
          <div class="chips">
            @for (r of priceRanges(f); track r.label) {
              <a class="chip" [class.on]="price_min() === r.min && price_max() === r.max" routerLink="/productos" [queryParams]="params({ price_min: price_min() === r.min && price_max() === r.max ? null : r.min, price_max: price_min() === r.min && price_max() === r.max ? null : r.max, page: null })">{{ r.label }}</a>
            }
          </div>
        </div>
        @if (activeCount()) { <a class="clear" routerLink="/productos" [queryParams]="params({ size: null, color: null, price_min: null, price_max: null, page: null })">Quitar filtros</a> }
      </div>
    }

    @if (activeCount() && !open()) {
      <div class="active">
        @if (size()) { <a class="pill" routerLink="/productos" [queryParams]="params({ size: null, page: null })">Talla {{ size() }} ✕</a> }
        @if (color()) { <a class="pill" routerLink="/productos" [queryParams]="params({ color: null, page: null })">{{ color() }} ✕</a> }
        @if (price_min() !== undefined || price_max() !== undefined) { <a class="pill" routerLink="/productos" [queryParams]="params({ price_min: null, price_max: null, page: null })">{{ priceLabel() }} ✕</a> }
      </div>
    }

    @if (loading()) {
      <div class="grid" aria-busy="true">
        @for (i of skeleton; track i) {
          <div class="sk-card"><div class="sk sk-img"></div><div class="sk sk-text" style="width:60%"></div><div class="sk sk-text" style="width:30%"></div></div>
        }
      </div>
    } @else if (error()) {
      <app-error-state (retry)="retry()" />
    } @else if (page()?.data?.length === 0) {
      <div class="empty">
        <h2>No encontramos nada</h2>
        @if (q()) { <p>No hay resultados para “{{ q() }}”. Revisa la ortografía o busca por tipo de prenda: camiseta, jean, chaqueta.</p> } @else { <p>Prueba quitando algún filtro.</p> }
        <div class="row" style="justify-content:center">
          @if (activeCount() || q()) { <a class="btn btn-primary" routerLink="/productos" [queryParams]="{ gender: gender() ?? null, category_id: category_id() ?? null }">Quitar filtros</a> }
          <a class="btn" routerLink="/productos">Ver todo</a>
        </div>
      </div>
    } @else if (page(); as p) {
      <div class="grid">
        @for (prod of p.data; track prod.id; let i = $index) { <app-product-card [product]="prod" [eager]="i < 4" /> }
      </div>
      @if (p.meta.last_page > 1) {
        <nav class="pager" aria-label="Paginación">
          <a class="btn" [class.disabled]="p.meta.current_page === 1" routerLink="/productos" [queryParams]="params({ page: p.meta.current_page - 1 })">Anterior</a>
          <span class="muted">Página {{ p.meta.current_page }} de {{ p.meta.last_page }}</span>
          <a class="btn" [class.disabled]="p.meta.current_page === p.meta.last_page" routerLink="/productos" [queryParams]="params({ page: p.meta.current_page + 1 })">Siguiente</a>
        </nav>
      }
    }
  `,
  styles: `
    .crumbs { display: flex; gap: 0.5rem; margin-bottom: 1rem; color: var(--ink-2); font-size: 0.8571rem; }
    .crumbs a { text-decoration: none; color: inherit; }
    .crumbs a:hover { color: var(--ink); text-decoration: underline; }
    .bar { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .bar-title { display: flex; align-items: baseline; gap: 0.75rem; }
    .bar-title h1 { font-size: 1.7143rem; margin: 0; }
    .bar-cats { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .bar-cats a { text-decoration: none; padding: 0.35rem 0.75rem; border: 1px solid transparent; transition: border-color var(--t) var(--ease); }
    .bar-cats a:hover { border-color: var(--line-2); }
    .bar-cats a.on { border-color: var(--ink); }
    .filters { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-bottom: 1px solid var(--line); margin-bottom: 1rem; flex-wrap: wrap; }
    .tabs { display: flex; gap: 1.25rem; }
    .tabs a { text-decoration: none; padding: 0.5rem 0; border-bottom: 2px solid transparent; margin-bottom: -1px; color: var(--ink-2); }
    .tabs a:hover { color: var(--ink); }
    .tabs a.on { color: var(--ink); border-bottom-color: var(--ink); }
    .tools { display: flex; gap: 1rem; align-items: center; }
    .ftr-btn { border: 1px solid var(--line-2); background: none; padding: 0.4rem 0.75rem; cursor: pointer; display: inline-flex; gap: 0.4rem; align-items: center; }
    .ftr-btn.on, .ftr-btn:hover { border-color: var(--ink); }
    .ftr-btn .n { background: var(--ink); color: var(--paper); border-radius: 999px; min-width: 1.1429rem; height: 1.1429rem; font-size: 0.7143rem; line-height: 1.1429rem; text-align: center; padding-inline: 0.25rem; }
    .sort { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1rem; color: var(--ink); }
    .sort select { width: auto; padding: 0.4rem 0.5rem; border-color: transparent; }
    .sort select:hover { border-color: var(--line-2); }
    .panel { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); padding: 1rem 0 1.25rem; border-bottom: 1px solid var(--line); margin-bottom: 1rem; position: relative; }
    .group-title { display: block; color: var(--ink-2); font-size: 0.8571rem; margin-bottom: 0.5rem; }
    .colors { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .color { display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; padding: 0.35rem 0.6rem; border: 1px solid var(--line-2); }
    .color i { width: 1rem; height: 1rem; border-radius: 999px; border: 1px solid var(--line-2); }
    .color.on { border-color: var(--ink); }
    .clear { grid-column: 1 / -1; justify-self: start; }
    .active { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .pill { text-decoration: none; border: 1px solid var(--ink); padding: 0.3rem 0.6rem; font-size: 0.8571rem; }
    .grid { display: grid; gap: var(--gap); grid-template-columns: repeat(2, 1fr); }
    @media (min-width: 700px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1100px) { .grid { grid-template-columns: repeat(4, 1fr); } }
    .sk-card { display: grid; gap: 0.4rem; padding-bottom: 1.5rem; }
    .sk-img { aspect-ratio: 3 / 4; }
    .sk-card .sk-text { margin: 0.5rem 0.5rem 0; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 2.5rem; }
    @media (max-width: 640px) { .filters { align-items: stretch; } .tabs { width: 100%; justify-content: space-between; gap: 0.5rem; } .tools { justify-content: space-between; } }
  `,
})
export class ProductList {
  private api = inject(ApiService);
  private router = inject(Router);
  private meta = inject(PageMeta);

  // Enlazados desde la query string (withComponentInputBinding).
  q = input<string>();
  gender = input<Gender | undefined>();
  badge = input<string | undefined>();
  size = input<string | undefined>();
  color = input<string | undefined>();
  sort = input<ProductSort | undefined>();
  price_min = input<number | undefined, string | number | undefined>(undefined, { transform: (v) => (v !== undefined && v !== '' ? Number(v) : undefined) });
  price_max = input<number | undefined, string | number | undefined>(undefined, { transform: (v) => (v !== undefined && v !== '' ? Number(v) : undefined) });
  category_id = input<number, string | number | undefined>(undefined as never, { transform: (v) => (v ? Number(v) : undefined) });
  page_ = input<string | number | undefined>(undefined, { alias: 'page' });

  protected categories = signal<Category[]>([]);
  protected facets = signal<ProductFilters | null>(null);
  protected page = signal<Paginated<Product> | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  private attempt = signal(0);
  protected open = signal(false);
  protected skeleton = [1, 2, 3, 4, 5, 6, 7, 8];
  protected genderLabel = GENDER_LABEL;
  protected swatch = swatch;

  protected category = computed(() => this.categories().find((c) => c.id === this.category_id()));
  protected parent = computed(() => { const c = this.category(); return c ? (c.parent_id ? this.categories().find((x) => x.id === c.parent_id) : c) : undefined; });
  protected roots = computed(() => this.categories().filter((c) => !c.parent_id));
  protected activeCount = computed(() => [this.size(), this.color(), this.price_min() ?? this.price_max()].filter((v) => v !== undefined && v !== null && v !== '').length);

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.productFilters().subscribe((f) => this.facets.set(f));
    const filters = computed(() => ({
      q: this.q(), gender: this.gender(), badge: this.badge(), category_id: this.category_id(), size: this.size(), color: this.color(),
      price_min: this.price_min(), price_max: this.price_max(), sort: this.sort(), page: Number(this.page_() ?? 1),
    }));
    toObservable(computed(() => [filters(), this.attempt()] as const))
      .pipe(
        tap(() => { this.loading.set(true); this.error.set(false); this.meta.set(this.title()); }),
        switchMap(([f]) => this.api.products(f).pipe(catchError(() => { this.error.set(true); return of(null); }))),
      )
      .subscribe((p) => { if (p) this.page.set(p); this.loading.set(false); });
  }

  retry() { this.attempt.update((n) => n + 1); }

  childrenOf(id: number) { return this.categories().filter((c) => c.parent_id === id); }

  title() {
    if (this.q()) return `Resultados para “${this.q()}”`;
    const cat = this.category()?.name;
    if (this.badge() === 'Nuevo') return cat ? `Novedades · ${cat}` : 'Novedades';
    const g = this.gender() ? GENDER_LABEL[this.gender()!] : null;
    if (g && cat) return `${cat} para ${g.toLowerCase()}`;
    return cat ?? g ?? 'Toda la tienda';
  }

  // Rangos de precio a partir del mínimo y máximo reales del catálogo.
  priceRanges(f: ProductFilters) {
    const cop = new CopPipe();
    const step = Math.max(10000, Math.round((f.price_max - f.price_min) / 4 / 10000) * 10000);
    const out: { label: string; min: number | null; max: number | null }[] = [];
    for (let i = 0; i < 4; i++) {
      const min = f.price_min + step * i;
      const max = i === 3 ? null : min + step - 1;
      if (min > f.price_max) break;
      out.push({ label: max ? `${cop.transform(min)} – ${cop.transform(max)}` : `Desde ${cop.transform(min)}`, min: i === 0 ? null : min, max });
    }
    return out;
  }
  priceLabel() {
    const cop = new CopPipe();
    if (this.price_min() !== undefined && this.price_max() !== undefined) return `${cop.transform(this.price_min())} – ${cop.transform(this.price_max())}`;
    if (this.price_min() !== undefined) return `Desde ${cop.transform(this.price_min())}`;
    return `Hasta ${cop.transform(this.price_max())}`;
  }

  setSort(v: string) {
    this.router.navigate(['/productos'], { queryParams: this.params({ sort: v === 'newest' ? null : v, page: null }) });
  }

  // Conserva los filtros actuales y sobreescribe los indicados.
  params(over: Record<string, unknown>) {
    return {
      q: this.q() || null, gender: this.gender() ?? null, badge: this.badge() ?? null, category_id: this.category_id() ?? null,
      size: this.size() ?? null, color: this.color() ?? null, price_min: this.price_min() ?? null, price_max: this.price_max() ?? null, sort: this.sort() ?? null,
      ...over,
    };
  }
}
