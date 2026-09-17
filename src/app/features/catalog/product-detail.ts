import { Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartStore } from '../../core/cart.store';
import { FavoritesStore } from '../../core/favorites.store';
import { Product } from '../../core/models';
import { productBadges } from '../../shared/badges';
import { BuyBox } from '../../shared/buy-box';
import { ProductCard } from '../../shared/product-card';
import { ProductImageComponent } from '../../shared/product-image';
import { PageMeta } from '../../shared/seo';
import { CopPipe, GENDER_LABEL } from '../../shared/ui';
import { ErrorState } from '../../shared/error-state';
import { NotFound } from '../errors/not-found';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, ProductImageComponent, BuyBox, ProductCard, ErrorState, NotFound, CopPipe],
  template: `
    @if (product(); as p) {
      <nav class="crumbs" aria-label="Estás en">
        <a routerLink="/">Inicio</a>
        @if (p.gender !== 'unisex') { <span>/</span><a routerLink="/productos" [queryParams]="{ gender: p.gender }">{{ genderLabel[p.gender] }}</a> }
        @if (p.category) { <span>/</span><a routerLink="/productos" [queryParams]="{ gender: p.gender === 'unisex' ? null : p.gender, category_id: p.category.id }">{{ p.category.name }}</a> }
      </nav>
      <div class="layout">
        <section class="gallery">
          @if (p.images.length) {
            @for (img of galleryFor(p, box.selectedColor()); track img.id; let i = $index) {
              <button type="button" class="zoomable" (click)="zoom.set(i)" [attr.aria-label]="'Ampliar foto ' + (i + 1)">
                <app-product-image [src]="img.url" [srcset]="img.srcset" sizes="(min-width: 900px) 40vw, 100vw" [name]="p.name" [category]="p.category?.name" [eager]="$first" />
              </button>
            }
          } @else {
            <app-product-image [name]="p.name" [category]="p.category?.name" [color]="box.selectedColor()" [eager]="true" />
          }
        </section>

        <section class="buy">
          <div class="sticky">
            @if (badges().length) { <div class="badges">@for (b of badges(); track b.text) { <span [class]="'b ' + b.kind">{{ b.text }}</span> }</div> }
            <div class="title-row">
              <h1>{{ p.name }}</h1>
              <button type="button" class="fav" [class.on]="fav.has(p.id)" (click)="fav.toggle(p)" [attr.aria-pressed]="fav.has(p.id)" [attr.aria-label]="fav.has(p.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'">
                <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
              </button>
            </div>
            <app-buy-box #box [product]="p" />

            @if (p.description) { <p class="desc">{{ p.description }}</p> }

            <details class="info">
              <summary>Envío y devoluciones</summary>
              <p>Envío a todo el país@if (cartStore.cart()?.shipping_free_from; as free) {; gratis desde {{ free | cop }}}. Tienes 15 días desde la entrega para solicitar una devolución desde tu pedido.</p>
            </details>
            <details class="info">
              <summary>Guía de tallas</summary>
              <div class="table-wrap sizes-table">
                <table>
                  <thead><tr><th>Talla</th><th class="num">Pecho (cm)</th><th class="num">Cintura (cm)</th><th class="num">Cadera (cm)</th></tr></thead>
                  <tbody>
                    @for (r of sizeGuide; track r.size) { <tr><td>{{ r.size }}</td><td class="num">{{ r.chest }}</td><td class="num">{{ r.waist }}</td><td class="num">{{ r.hip }}</td></tr> }
                  </tbody>
                </table>
              </div>
              <p class="small">Mide una prenda que te quede bien y compárala. Entre dos tallas, elige la mayor.</p>
            </details>
            <details class="info">
              <summary>Composición y cuidado</summary>
              <p>100 % algodón peinado, hecho en Colombia. {{ genderLabel[p.gender] }}.</p>
              <ul class="care">
                <li>Lavar a máquina con agua fría, colores similares.</li>
                <li>No usar blanqueador. Secar a la sombra.</li>
                <li>Planchar a temperatura media, del revés.</li>
              </ul>
            </details>
          </div>
        </section>
      </div>

      @if (related().length) {
        <section class="related">
          <h2>También te puede gustar</h2>
          <div class="grid">
            @for (r of related(); track r.id) { <app-product-card [product]="r" /> }
          </div>
        </section>
      }
      @if (zoom() !== null) {
        <div class="lightbox" (click)="zoom.set(null)" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          <button type="button" class="lb-close" aria-label="Cerrar">&#x2715;</button>
          @if (galleryFor(p, box.selectedColor())[zoom()!]; as img) { <img [src]="img.url" [attr.srcset]="img.srcset" sizes="100vw" [alt]="p.name" (click)="$event.stopPropagation()" /> }
          @if (galleryFor(p, box.selectedColor()).length > 1) {
            <button type="button" class="lb-nav prev" (click)="step(-1, p); $event.stopPropagation()" aria-label="Anterior">&#x2039;</button>
            <button type="button" class="lb-nav next" (click)="step(1, p); $event.stopPropagation()" aria-label="Siguiente">&#x203A;</button>
          }
        </div>
      }
    } @else if (notFound()) {
      <app-not-found title="Este producto ya no está" text="Se agotó o se retiró del catálogo. Lo que sí tenemos está a un clic." />
    } @else if (error()) {
      <app-error-state (retry)="retry()" />
    } @else {
      <div class="layout" aria-busy="true">
        <div class="sk" style="aspect-ratio:3/4"></div>
        <div><div class="sk sk-text" style="width:70%;height:1.6em"></div><div class="sk sk-text" style="width:30%"></div><div class="sk" style="height:3rem;margin-top:2rem"></div></div>
      </div>
    }
  `,
  styles: `
    .crumbs { display: flex; gap: 0.5rem; margin-bottom: 1rem; color: var(--ink-2); font-size: 0.8571rem; }
    .crumbs a { text-decoration: none; color: inherit; }
    .crumbs a:hover { color: var(--ink); text-decoration: underline; }
    .layout { display: grid; gap: 2rem; grid-template-columns: 1fr; }
    @media (min-width: 900px) {
      .layout { grid-template-columns: minmax(0, 7fr) minmax(320px, 5fr); gap: clamp(2rem, 5vw, 5rem); align-items: start; }
      .sticky { position: sticky; top: 5rem; }
    }
    .gallery { display: grid; gap: var(--gap); }
    @media (min-width: 1200px) { .gallery { grid-template-columns: 1fr 1fr; } .gallery > :first-child:last-child { grid-column: 1 / -1; max-width: 640px; } }
    .buy h1 { font-size: 1.5714rem; margin-bottom: 1rem; }
    .title-row { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
    .fav { border: 0; background: none; cursor: pointer; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; flex: none; }
    .fav svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; transition: transform var(--t) var(--ease); }
    .fav:hover svg { transform: scale(1.1); }
    .fav.on svg { fill: var(--ink); }
    .zoomable { display: block; border: 0; padding: 0; background: none; cursor: zoom-in; width: 100%; }
    .sizes-table { border-top: 0; margin-bottom: 0.75rem; }
    .care { color: var(--ink-2); padding-left: 1.1rem; margin: 0 0 0.8571rem; }
    .care li { margin-bottom: 0.25rem; }
    .lightbox { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.92); z-index: 60; display: grid; place-items: center; cursor: zoom-out; }
    .lightbox img { max-width: min(96vw, 1000px); max-height: 94vh; object-fit: contain; cursor: default; }
    .lb-close, .lb-nav { position: absolute; border: 0; background: none; color: #fff; font-size: 2rem; cursor: pointer; width: 3rem; height: 3rem; }
    .lb-close { top: 0.75rem; right: 0.75rem; font-size: 1.5rem; }
    .lb-nav { top: 50%; transform: translateY(-50%); font-size: 3rem; }
    .lb-nav.prev { left: 0.5rem; }
    .lb-nav.next { right: 0.5rem; }
    .badges { display: flex; gap: 0.35rem; margin-bottom: 0.75rem; }
    .b { padding: 0.2rem 0.5rem; font-size: 0.7857rem; font-weight: 500; background: var(--wash); }
    .b.editorial { background: var(--ink); color: var(--paper); }
    .b.low { color: var(--warn-ink); }
    .b.out { color: var(--ink-2); }
    .desc { color: var(--ink-2); margin-top: 1.75rem; }
    .info { border-top: 1px solid var(--line); }
    .info:last-child { border-bottom: 1px solid var(--line); }
    .info summary { cursor: pointer; padding: 0.8571rem 0; list-style: none; display: flex; justify-content: space-between; }
    .info summary::-webkit-details-marker { display: none; }
    .info summary::after { content: '+'; color: var(--ink-2); }
    .info[open] summary::after { content: '−'; }
    .info p { color: var(--ink-2); padding-bottom: 0.8571rem; }
    .related { margin-top: 4rem; }
    .related h2 { margin-bottom: 1rem; }
    .grid { display: grid; gap: var(--gap); grid-template-columns: repeat(2, 1fr); }
    @media (min-width: 700px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  `,
})
export class ProductDetail {
  private api = inject(ApiService);
  protected cartStore = inject(CartStore);

  id = input.required<string>();

  protected product = signal<Product | null>(null);
  protected related = signal<Product[]>([]);
  protected notFound = signal(false);
  protected error = signal(false);
  private attempt = signal(0);
  protected fav = inject(FavoritesStore);
  private meta = inject(PageMeta);
  protected genderLabel = GENDER_LABEL;
  protected zoom = signal<number | null>(null);
  protected sizeGuide = [
    { size: 'S', chest: '86–92', waist: '70–76', hip: '88–94' }, { size: 'M', chest: '92–98', waist: '76–82', hip: '94–100' },
    { size: 'L', chest: '98–106', waist: '82–90', hip: '100–108' }, { size: 'XL', chest: '106–114', waist: '90–98', hip: '108–116' },
  ];
  protected badges = computed(() => (this.product() ? productBadges(this.product()!) : []));

  constructor() {
    toObservable(computed(() => [this.id(), this.attempt()] as const))
      .pipe(
        tap(() => { this.product.set(null); this.notFound.set(false); this.error.set(false); }),
        switchMap(([id]) => this.api.product(Number(id)).pipe(catchError((e: HttpErrorResponse) => { (e.status === 404 ? this.notFound : this.error).set(true); return EMPTY; }))),
      )
      .subscribe({
        next: (p) => {
          this.product.set(p);
          window.scrollTo({ top: 0 });
          const price = new CopPipe().transform(Math.min(...(p.variants?.map((v) => v.price) ?? [0])));
          this.meta.set(p.name, { description: `${p.name} · ${price}. ${p.description ?? ''}`.trim(), image: p.image, type: 'product' });
          if (p.category) {
            // Relacionados por la categoría madre: la subcategoría suele tener muy pocos.
            this.api.products({ category_id: p.category.parent_id ?? p.category.id, per_page: 5 }).subscribe((r) => this.related.set(r.data.filter((x) => x.id !== p.id).slice(0, 4)));
          }
        },
      });
  }

  retry() { this.attempt.update((n) => n + 1); }

  // Fotos del color elegido; si ninguna tiene color, todas. Las fotos sin color siempre acompañan.
  galleryFor(p: Product, color: string | null) {
    const tinted = p.images.filter((i) => i.color);
    if (!tinted.length || !color) return p.images;
    const mine = p.images.filter((i) => !i.color || i.color.toLowerCase() === color.toLowerCase());
    return mine.some((i) => i.color) ? mine : p.images;
  }

  step(dir: number, p: Product) {
    const n = this.galleryFor(p, null).length;
    this.zoom.update((z) => (z === null ? null : (z + dir + n) % n));
  }

  @HostListener('document:keydown.escape') onEsc() { this.zoom.set(null); }
}
