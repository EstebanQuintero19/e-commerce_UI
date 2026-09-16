import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FavoritesStore } from '../../core/favorites.store';
import { ProductCard } from '../../shared/product-card';
import { PageMeta } from '../../shared/seo';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, ProductCard],
  template: `
    <div class="page-head">
      <h1>Favoritos <span class="muted count">{{ fav.count() }}</span></h1>
      @if (!auth.isLoggedIn() && fav.count()) { <span class="muted small">Guardados en este navegador. <a routerLink="/login" [queryParams]="{ redirect: '/favoritos' }">Inicia sesión</a> para tenerlos en todos tus dispositivos.</span> }
    </div>
    @if (products(); as list) {
      @if (list.length === 0) {
        <div class="empty">
          <h2>Aún no tienes favoritos</h2>
          <p>Toca el corazón de un producto para guardarlo aquí.</p>
          <a class="btn" routerLink="/productos">Ir a la tienda</a>
        </div>
      } @else {
        <div class="grid">@for (p of list; track p.id) { <app-product-card [product]="p" /> }</div>
      }
    } @else {
      <div class="grid" aria-busy="true">@for (i of [1, 2, 3, 4]; track i) { <div class="sk" style="aspect-ratio:3/4"></div> }</div>
    }
  `,
  styles: `
    .count { font-weight: 400; font-size: 0.6em; margin-left: 0.25rem; }
    .grid { display: grid; gap: var(--gap); grid-template-columns: repeat(2, 1fr); }
    @media (min-width: 700px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1100px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  `,
})
export class Favorites {
  protected fav = inject(FavoritesStore);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  protected products = computed(() => this.fav.products());

  constructor() {
    inject(PageMeta).set('Favoritos');
    if (this.auth.isLoggedIn()) {
      this.fav.load();
    } else {
      // Invitado: los ids están en el navegador; se piden los productos uno a uno (pocos).
      const ids = [...this.fav.ids()];
      if (!ids.length) { this.fav.products.set([]); return; }
      forkJoin(ids.map((id) => this.api.product(id))).subscribe({
        next: (list) => this.fav.products.set(list),
        error: () => this.fav.products.set([]),
      });
    }
  }
}
