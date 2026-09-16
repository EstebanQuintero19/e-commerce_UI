import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { ProductImageComponent, swatch } from './product-image';
import { productBadges } from './badges';
import { FavoritesStore } from '../core/favorites.store';
import { QuickViewService } from './quick-view';
import { CopPipe } from './ui';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, CopPipe, ProductImageComponent],
  template: `
    <a class="item" [routerLink]="['/productos', product().id]" (mouseenter)="hover.set(true)" (mouseleave)="hover.set(false)">
      <div class="img-wrap">
        <app-product-image [src]="image()?.url" [srcset]="image()?.srcset" [name]="product().name" [category]="product().category?.name" [color]="colorFor()" [eager]="eager()" />
        <button type="button" class="fav" [class.on]="fav.has(product().id)" (click)="toggleFav($event)" [attr.aria-label]="fav.has(product().id) ? 'Quitar de favoritos' : 'Guardar en favoritos'" [attr.aria-pressed]="fav.has(product().id)">
          <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
        </button>
        @if (badges().length) {
          <div class="badges">
            @for (b of badges(); track b.text) { <span class="badge-p" [class]="'badge-p ' + b.kind">{{ b.text }}</span> }
          </div>
        }
        <button type="button" class="quick" (click)="quick($event)" [attr.aria-label]="'Vista rápida de ' + product().name">Vista rápida</button>
      </div>
      <div class="meta">
        <span class="name">{{ product().name }}</span>
        <span class="price">{{ price() | cop }}</span>
        <span class="swatches" aria-hidden="true">
          @for (c of colors(); track c) { <i [style.background]="swatch(c)" [title]="c"></i> }
        </span>
      </div>
    </a>
  `,
  styles: `
    :host { display: block; }
    .item { display: block; text-decoration: none; color: inherit; }
    .img-wrap { position: relative; overflow: hidden; }
    .img-wrap app-product-image { transition: transform 700ms var(--ease); }
    .item:hover .img-wrap app-product-image { transform: scale(1.025); }
    .badges { position: absolute; left: 0.5rem; top: 0.5rem; display: grid; gap: 0.25rem; justify-items: start; }
    .badge-p { background: var(--paper); color: var(--ink); padding: 0.2rem 0.5rem; font-size: 0.7857rem; font-weight: 500; }
    .badge-p.editorial { background: var(--ink); color: var(--paper); }
    .badge-p.low { color: var(--warn-ink); }
    .badge-p.out { color: var(--ink-2); }
    .fav { position: absolute; right: 0.35rem; top: 0.35rem; width: 2.25rem; height: 2.25rem; border: 0; background: none; cursor: pointer; display: grid; place-items: center; color: var(--ink); }
    .fav svg { width: 22px; height: 22px; fill: rgba(255, 255, 255, 0.7); stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; transition: transform var(--t) var(--ease), fill var(--t) var(--ease); }
    .fav:hover svg { transform: scale(1.1); }
    .fav.on svg { fill: var(--ink); }
    @media (prefers-reduced-motion: no-preference) { .fav.on svg { animation: heart 320ms var(--ease); } @keyframes heart { 40% { transform: scale(1.35); } } }
    .quick {
      position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; padding: 0.6rem; border: 0; background: rgba(255, 255, 255, 0.92); color: var(--ink);
      font-weight: 500; cursor: pointer; opacity: 0; transform: translateY(6px); transition: opacity var(--t) var(--ease), transform var(--t) var(--ease);
    }
    .item:hover .quick, .quick:focus-visible { opacity: 1; transform: none; }
    .quick:hover { background: var(--paper); }
    @media (hover: none) { .quick { display: none; } }
    .meta { display: grid; gap: 0.15rem; padding: 0.75rem 0.5rem 1.5rem; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .swatches { display: flex; gap: 0.35rem; margin-top: 0.25rem; }
    .swatches i { width: 0.7143rem; height: 0.7143rem; border-radius: 999px; border: 1px solid var(--line-2); display: inline-block; }
  `,
})
export class ProductCard {
  private quickView = inject(QuickViewService);
  protected fav = inject(FavoritesStore);
  product = input.required<Product>();
  eager = input(false);

  protected hover = signal(false);
  protected swatch = swatch;
  protected badges = computed(() => productBadges(this.product()));
  protected price = computed(() => Math.min(...(this.product().variants?.map((v) => v.price) ?? [0])));
  protected colors = computed(() => [...new Set(this.product().variants?.map((v) => v.color).filter((c): c is string => !!c))]);
  protected colorFor = computed(() => this.product().variants?.find((v) => v.available > 0)?.color ?? this.product().variants?.[0]?.color ?? null);
  // Al pasar el mouse se muestra la segunda foto, si la hay.
  protected image = computed(() => (this.hover() && this.product().images?.[1] ? this.product().images[1] : this.product().images?.[0] ?? null));

  toggleFav(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.fav.toggle(this.product());
  }

  quick(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.quickView.open(this.product());
  }
}
