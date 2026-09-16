import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Category, Product, ProductImage } from '../../core/models';
import { ProductCard } from '../../shared/product-card';
import { PageMeta } from '../../shared/seo';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  template: `
    <section class="hero bleed">
      <img src="img/hero-1024.webp" srcset="img/hero-640.webp 640w, img/hero-1024.webp 1024w, img/hero-1600.webp 1600w" sizes="100vw" alt="" fetchpriority="high" width="1600" height="889" />
      <div class="hero-copy container">
        <p class="kicker">Nueva temporada</p>
        <h1>Básicos que se quedan</h1>
        <p>Algodón hecho en Colombia, para todos los días.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" routerLink="/productos" [queryParams]="{ gender: 'mujer' }">Comprar mujer</a>
          <a class="btn" routerLink="/productos" [queryParams]="{ gender: 'hombre' }">Comprar hombre</a>
        </div>
      </div>
    </section>

    <section class="genders">
      <a class="tile" routerLink="/productos" [queryParams]="{ gender: 'mujer' }">
        <img src="img/mujer-480.webp" srcset="img/mujer-480.webp 480w, img/mujer-800.webp 800w" sizes="50vw" alt="" loading="lazy" width="800" height="1067" />
        <span class="tile-label"><strong>Mujer</strong><span>Ver todo</span></span>
      </a>
      <a class="tile" routerLink="/productos" [queryParams]="{ gender: 'hombre' }">
        <img src="img/hombre-480.webp" srcset="img/hombre-480.webp 480w, img/hombre-800.webp 800w" sizes="50vw" alt="" loading="lazy" width="800" height="1067" />
        <span class="tile-label"><strong>Hombre</strong><span>Ver todo</span></span>
      </a>
    </section>

    <section class="strip">
      <div class="strip-head">
        <h2>Novedades</h2>
        <a routerLink="/productos" [queryParams]="{ badge: 'Nuevo' }">Ver todas</a>
      </div>
      <div class="scroller">
        @if (news().length) {
          @for (p of news(); track p.id) { <app-product-card [product]="p" /> }
        } @else {
          @for (i of [1, 2, 3, 4]; track i) { <div class="sk" style="aspect-ratio:3/4"></div> }
        }
      </div>
    </section>

    <section class="cats">
      <h2>Por categoría</h2>
      <div class="cats-grid">
        @for (c of cats(); track c.category.id) {
          <a class="cat" routerLink="/productos" [queryParams]="{ category_id: c.category.id }">
            @if (c.image) { <img [src]="c.image.url" [attr.srcset]="c.image.srcset" sizes="(min-width: 640px) 33vw, 100vw" alt="" loading="lazy" /> } @else { <div class="sk" style="height:100%"></div> }
            <span class="tile-label"><strong>{{ c.category.name }}</strong></span>
          </a>
        }
      </div>
    </section>

    <section class="props">
      <div><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg><strong>Envío gratis desde $ 250.000</strong><span>A todo el país.</span></div>
      <div><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg><strong>30 días para devolver</strong><span>Desde tu pedido, sin preguntas.</span></div>
      <div><svg viewBox="0 0 24 24"><path d="M12 3c-4 4-6 7-6 11a6 6 0 0 0 12 0c0-4-2-7-6-11z"/></svg><strong>Algodón colombiano</strong><span>Hecho aquí, con talleres locales.</span></div>
    </section>
  `,
  styles: `
    .bleed { width: 100vw; margin-left: calc(50% - 50vw); }
    .hero { position: relative; margin-top: -1.5rem; min-height: clamp(420px, 70vh, 720px); display: grid; align-items: end; overflow: hidden; }
    .hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }
    .hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0) 60%); }
    .hero-copy { position: relative; z-index: 1; color: #fff; padding-block: 2.5rem; width: 100%; }
    .kicker { margin-bottom: 0.5rem; opacity: 0.85; }
    .hero h1 { font-size: clamp(2.25rem, 6vw, 4.5rem); max-width: 12ch; margin-bottom: 0.25em; }
    .hero-copy p:not(.kicker) { font-size: 1.1429rem; opacity: 0.9; }
    .hero-cta { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.25rem; }
    .hero-cta .btn { background: #fff; color: #000; border-color: #fff; }
    .hero-cta .btn-primary { background: #000; color: #fff; border-color: #000; }
    .genders { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-top: var(--gap); }
    .tile, .cat { position: relative; display: block; overflow: hidden; aspect-ratio: 3 / 4; background: var(--wash); text-decoration: none; }
    .tile img, .cat img { width: 100%; height: 100%; object-fit: cover; transition: transform 800ms var(--ease); }
    .tile:hover img, .cat:hover img { transform: scale(1.03); }
    .tile-label { position: absolute; left: 1rem; bottom: 1rem; background: var(--paper); padding: 0.6rem 0.9rem; display: grid; gap: 0.1rem; }
    .tile-label strong { font-size: 1.1429rem; }
    .tile-label span:not(strong) { color: var(--ink-2); font-size: 0.8571rem; }
    @media (min-width: 900px) { .tile { aspect-ratio: 4 / 3; } }
    .strip, .cats { margin-top: 3.5rem; }
    .strip-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
    .strip-head h2, .cats h2 { margin: 0; }
    .cats h2 { margin-bottom: 1rem; }
    .scroller { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(180px, 1fr); gap: var(--gap); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 0.5rem; scrollbar-width: thin; }
    .scroller > * { scroll-snap-align: start; }
    @media (min-width: 1100px) { .scroller { grid-auto-columns: calc((100% - 3 * var(--gap)) / 4); } }
    .cats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap); }
    .cat { aspect-ratio: 3 / 4; }
    @media (max-width: 640px) { .cats-grid { grid-template-columns: 1fr; } .cat { aspect-ratio: 16 / 9; } }
    .props { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-top: 3.5rem; padding-top: 2rem; border-top: 1px solid var(--line); }
    .props div { display: grid; gap: 0.15rem; justify-items: start; }
    .props svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; margin-bottom: 0.5rem; }
    .props span { color: var(--ink-2); }
  `,
})
export class Home {
  private api = inject(ApiService);
  protected news = signal<Product[]>([]);
  protected cats = signal<{ category: Category; image: ProductImage | null }[]>([]);

  constructor() {
    inject(PageMeta).set(null);
    this.api.products({ badge: 'Nuevo', per_page: 8 }).subscribe((r) => this.news.set(r.data));
    this.api.categories().subscribe((all) => {
      const categories = all.filter((c) => !c.parent_id);
      forkJoin(categories.map((category) => this.api.products({ category_id: category.id, per_page: 1 }).pipe(map((r) => ({ category, image: r.data[0]?.images?.[0] ?? null })))))
        .subscribe((c) => this.cats.set(c));
    });
  }
}
