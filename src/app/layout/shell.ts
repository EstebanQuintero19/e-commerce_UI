import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CartStore } from '../core/cart.store';
import { FavoritesStore } from '../core/favorites.store';
import { Category, Gender, Product } from '../core/models';
import { BagDrawer } from '../shared/bag-drawer';
import { ProductImageComponent } from '../shared/product-image';
import { QuickView } from '../shared/quick-view';
import { CopPipe, ToastService } from '../shared/ui';
import { ErrorState } from '../shared/error-state';

const GENDERS: { key: Gender; label: string }[] = [{ key: 'mujer', label: 'Mujer' }, { key: 'hombre', label: 'Hombre' }];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, QuickView, BagDrawer, ProductImageComponent, CopPipe, ErrorState],
  template: `
    <div class="progress" [class.on]="navigating()" aria-hidden="true"></div>

    <header class="hdr" (mouseleave)="mega.set(null)">
      <div class="container hdr-in">
        <button type="button" class="icon-btn menu-btn" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-label="Menú">
          @if (menu()) {
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          } @else {
            <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          }
        </button>

        <a routerLink="/" class="brand" aria-label="Mi Tienda, inicio">Mi Tienda</a>

        <nav class="nav" aria-label="Principal">
          @for (g of genders; track g.key) {
            <a routerLink="/productos" [queryParams]="{ gender: g.key }" [class.on]="param('gender') === g.key" (mouseenter)="mega.set(g.key)" (focus)="mega.set(g.key)">{{ g.label }}</a>
          }
          <a routerLink="/productos" [queryParams]="{ badge: 'Nuevo' }" [class.on]="param('badge') === 'Nuevo'" (mouseenter)="mega.set(null)">Novedades</a>
        </nav>

        <div class="tools">
          <form class="search" [class.open]="searchOpen()" (ngSubmit)="search()" role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input #searchInput type="search" name="q" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Buscar" aria-label="Buscar productos" autocomplete="off" maxlength="80" (blur)="onSearchBlur()" (focus)="suggestOpen.set(true)" (input)="suggestOpen.set(true)" />
            @if (suggestOpen() && q().trim().length >= 2) {
              <div class="suggest" (mousedown)="$event.preventDefault()">
                @if (suggestions(); as list) {
                  @if (list.length) {
                    @for (p of list; track p.id) {
                      <a [routerLink]="['/productos', p.id]" (click)="closeSearch()">
                        <app-product-image [src]="p.image" [srcset]="p.images[0]?.srcset" sizes="48px" [name]="p.name" [category]="p.category?.name" />
                        <span>{{ p.name }}<br /><span class="muted small">{{ p.category?.name }}</span></span>
                        <span class="price">{{ (p.min_price ?? 0) | cop }}</span>
                      </a>
                    }
                    <button type="submit" class="all">Ver todos los resultados para “{{ q() }}”</button>
                  } @else {
                    <div class="none muted">Nada para “{{ q() }}”. Prueba con camiseta, jean o chaqueta.</div>
                  }
                } @else {
                  <div class="none muted">Buscando…</div>
                }
              </div>
            }
          </form>
          <button type="button" class="icon-btn search-btn" (click)="openSearch()" aria-label="Buscar">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          </button>
          @if (auth.isAdmin()) { <a routerLink="/admin" routerLinkActive="on" class="admin-link">Admin</a> }
          <a routerLink="/favoritos" routerLinkActive="on" class="icon-btn" aria-label="Favoritos">
            <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
            @if (fav.count() > 0) { <span class="bag-n">{{ fav.count() }}</span> }
          </a>
          <a [routerLink]="auth.isLoggedIn() ? '/cuenta' : '/login'" routerLinkActive="on" class="icon-btn" [attr.aria-label]="auth.isLoggedIn() ? 'Mi cuenta' : 'Iniciar sesión'">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          </a>
          <button type="button" class="icon-btn bag" (click)="cartStore.drawerOpen.set(true)" aria-label="Bolsa">
            <svg viewBox="0 0 24 24"><path d="M6 8h12l1 13H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
            @if (cartStore.count() > 0) { <span class="bag-n" [class.bump]="bump()">{{ cartStore.count() }}</span> }
          </button>
        </div>
      </div>

      <!-- Desplegable: categorías y subcategorías del género sobre el que está el mouse -->
      @if (mega(); as g) {
        <div class="mega" (click)="mega.set(null)">
          <div class="container mega-in">
            <div class="col">
              <a routerLink="/productos" [queryParams]="{ gender: g }" class="col-title">Todo {{ g }}</a>
              <a routerLink="/productos" [queryParams]="{ gender: g, badge: 'Nuevo' }">Novedades</a>
            </div>
            @for (c of roots(); track c.id) {
              <div class="col">
                <a routerLink="/productos" [queryParams]="{ gender: g, category_id: c.id }" class="col-title">{{ c.name }}</a>
                @for (s of childrenOf(c.id); track s.id) { <a routerLink="/productos" [queryParams]="{ gender: g, category_id: s.id }">{{ s.name }}</a> }
              </div>
            }
          </div>
        </div>
      }

      @if (menu()) {
        <nav class="nav-m container" (click)="menu.set(false)" aria-label="Menú">
          @for (g of genders; track g.key) {
            <details class="nav-m-group" (click)="$event.stopPropagation()">
              <summary>{{ g.label }}</summary>
              <a routerLink="/productos" [queryParams]="{ gender: g.key }" (click)="menu.set(false)">Todo {{ g.key }}</a>
              @for (c of roots(); track c.id) {
                <a routerLink="/productos" [queryParams]="{ gender: g.key, category_id: c.id }" (click)="menu.set(false)"><strong>{{ c.name }}</strong></a>
                @for (s of childrenOf(c.id); track s.id) { <a class="sub" routerLink="/productos" [queryParams]="{ gender: g.key, category_id: s.id }" (click)="menu.set(false)">{{ s.name }}</a> }
              }
            </details>
          }
          <a routerLink="/productos" [queryParams]="{ badge: 'Nuevo' }" class="nav-m-title">Novedades</a>
          <a routerLink="/favoritos" class="nav-m-title">Favoritos</a>
          <hr />
          @if (auth.isLoggedIn()) {
            <a routerLink="/pedidos">Mis pedidos</a>
            <a routerLink="/facturas">Mis facturas</a>
            <a routerLink="/cuenta">Mi cuenta</a>
            @if (auth.isAdmin()) { <a routerLink="/admin">Administración</a> }
          } @else {
            <a routerLink="/login">Iniciar sesión</a>
            <a routerLink="/registro">Crear cuenta</a>
          }
        </nav>
      }
    </header>

    <main class="container page">
      @if (navError()) { <app-error-state title="No pudimos abrir esta página" (retry)="location.reload()" /> } @else { <router-outlet /> }
    </main>

    <footer class="ftr">
      <div class="container ftr-in">
        <div class="ftr-col">
          <strong>Mi Tienda</strong>
          <span class="muted">Ropa de algodón hecha en Colombia.</span>
        </div>
        <div class="ftr-col">
          <strong>Tienda</strong>
          <a routerLink="/productos" [queryParams]="{ gender: 'mujer' }">Mujer</a>
          <a routerLink="/productos" [queryParams]="{ gender: 'hombre' }">Hombre</a>
          <a routerLink="/productos" [queryParams]="{ badge: 'Nuevo' }">Novedades</a>
          @if (auth.isLoggedIn()) { <a routerLink="/pedidos">Mis pedidos</a> } @else { <a routerLink="/login">Iniciar sesión</a> }
        </div>
        <div class="ftr-col">
          <strong>Compras</strong>
          @if (cartStore.cart()?.shipping_free_from; as free) { <span class="muted">Envío a todo el país; gratis desde {{ free | cop }}.</span> }
          <span class="muted">15 días para devolver desde la entrega.</span>
          <span class="muted">Precios en pesos colombianos con IVA incluido.</span>
        </div>
      </div>
    </footer>

    <app-quick-view />
    <app-bag-drawer />

    <div class="toasts" aria-live="polite">
      @for (t of toast.items(); track t.id) { <div class="toast" [class.toast-err]="t.kind === 'err'" [class.toast-ok]="t.kind === 'ok'">{{ t.text }}</div> }
    </div>
  `,
  styles: `
    .progress { position: fixed; top: 0; left: 0; height: 2px; width: 0; background: var(--ink); z-index: 30; opacity: 0; transition: width 400ms var(--ease), opacity 200ms; }
    .progress.on { width: 70%; opacity: 1; }
    .hdr { background: var(--paper); position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--line); }
    .hdr-in { display: flex; align-items: center; gap: 2rem; height: 3.75rem; }
    .brand { text-decoration: none; font-weight: 700; font-size: 1.3571rem; letter-spacing: -0.04em; white-space: nowrap; }
    .nav { display: flex; gap: 1.5rem; align-self: stretch; align-items: center; }
    .nav a { text-decoration: none; padding-block: 0.25rem; border-bottom: 1px solid transparent; transition: border-color var(--t) var(--ease); }
    .nav a:hover, .nav a.on { border-bottom-color: var(--ink); }
    .mega { position: absolute; left: 0; right: 0; top: 100%; background: var(--paper); border-bottom: 1px solid var(--line); box-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.25); }
    .mega-in { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, max-content)); gap: 3rem; padding-block: 1.5rem 1.75rem; }
    .col { display: grid; gap: 0.4rem; align-content: start; }
    .col a { text-decoration: none; color: var(--ink-2); }
    .col a:hover { color: var(--ink); text-decoration: underline; }
    .col-title { color: var(--ink) !important; font-weight: 600; margin-bottom: 0.25rem; }
    .tools { margin-left: auto; display: flex; align-items: center; gap: 0.25rem; }
    .icon-btn {
      display: inline-grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 0; background: none; cursor: pointer;
      color: var(--ink); text-decoration: none; position: relative; border-radius: 0;
    }
    .icon-btn svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transition: transform var(--t) var(--ease); }
    .icon-btn:hover svg { transform: translateY(-1px); }
    .search { display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--ink); width: 0; overflow: hidden; transition: width 220ms var(--ease); position: relative; }
    .search.open { width: 280px; overflow: visible; }
    .search svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; flex: none; }
    .search input { border: 0; background: none; font: inherit; padding: 0.4rem 0; width: 100%; outline: none; color: var(--ink); }
    .search input::-webkit-search-cancel-button { appearance: none; }
    .suggest { position: absolute; top: calc(100% + 1px); left: 0; right: 0; background: var(--paper); border: 1px solid var(--line); box-shadow: 0 16px 32px -20px rgba(0, 0, 0, 0.35); z-index: 5; display: grid; }
    .suggest a { display: grid; grid-template-columns: 2.5rem 1fr auto; gap: 0.75rem; align-items: center; padding: 0.5rem 0.75rem; text-decoration: none; }
    .suggest a:hover { background: var(--wash); }
    .suggest app-product-image { width: 2.5rem; }
    .suggest .all { border: 0; border-top: 1px solid var(--line); background: none; padding: 0.75rem; cursor: pointer; text-align: left; color: var(--ink-2); }
    .suggest .all:hover { color: var(--ink); background: var(--wash); }
    .suggest .none { padding: 0.75rem; }
    .admin-link { text-decoration: none; padding: 0.35rem 0.6rem; border: 1px solid var(--line-2); margin-inline: 0.5rem; }
    .admin-link:hover, .admin-link.on { border-color: var(--ink); }
    .bag-n {
      position: absolute; top: 4px; right: 2px; min-width: 1.1429rem; height: 1.1429rem; padding-inline: 0.25rem; border-radius: 999px;
      background: var(--ink); color: var(--paper); font-size: 0.7143rem; font-weight: 600; line-height: 1.1429rem; text-align: center;
    }
    .menu-btn { display: none; }
    .nav-m { display: grid; gap: 0.15rem; padding-block: 0.5rem 1.25rem; font-size: 1.1429rem; }
    .nav-m a { text-decoration: none; padding: 0.4rem 0; }
    .nav-m-group { border-bottom: 1px solid var(--line); }
    .nav-m-group summary { cursor: pointer; padding: 0.6rem 0; font-weight: 600; list-style: none; display: flex; justify-content: space-between; }
    .nav-m-group summary::-webkit-details-marker { display: none; }
    .nav-m-group summary::after { content: '+'; color: var(--ink-2); }
    .nav-m-group[open] summary::after { content: '−'; }
    .nav-m-group a { display: block; font-size: 1rem; padding-left: 0.5rem; }
    .nav-m-group a.sub { padding-left: 1.5rem; color: var(--ink-2); }
    .nav-m-title { font-weight: 600; }
    .nav-m hr { border: 0; border-top: 1px solid var(--line); margin: 0.5rem 0; }
    .ftr { border-top: 1px solid var(--line); background: var(--wash); margin-top: 2rem; }
    .ftr-in { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); padding-block: 2.5rem 3rem; }
    .ftr-col { display: grid; gap: 0.5rem; justify-items: start; align-content: start; }
    .ftr-col a { text-decoration: none; }
    .ftr-col a:hover { text-decoration: underline; }
    @media (prefers-reduced-motion: no-preference) {
      .bag-n.bump { animation: bump 360ms var(--ease); }
      @keyframes bump { 30% { transform: scale(1.35); } }
    }
    @media (max-width: 860px) {
      .hdr-in { gap: 0.5rem; }
      .nav, .mega, .admin-link { display: none; }
      .menu-btn { display: inline-grid; }
      .brand { position: absolute; left: 50%; transform: translateX(-50%); }
      .search.open { position: absolute; left: 0; right: 0; top: 3.75rem; width: auto; background: var(--paper); padding: 0.75rem var(--gutter); border-bottom: 1px solid var(--line); }
      .suggest { left: var(--gutter); right: var(--gutter); }
    }
  `,
})
export class Shell {
  protected auth = inject(AuthService);
  protected cartStore = inject(CartStore);
  protected fav = inject(FavoritesStore);
  protected toast = inject(ToastService);
  private api = inject(ApiService);
  private router = inject(Router);

  protected genders = GENDERS;
  protected categories = signal<Category[]>([]);
  protected roots = computed(() => this.categories().filter((c) => !c.parent_id));
  protected menu = signal(false);
  protected mega = signal<Gender | null>(null);
  protected searchOpen = signal(false);
  protected suggestOpen = signal(false);
  protected suggestions = signal<Product[] | null>(null);
  protected navigating = signal(false);
  protected navError = signal(false);
  protected location = location;
  protected bump = signal(false);
  protected q = signal('');
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    // Sugerencias mientras se escribe (mínimo 2 letras, con espera corta).
    toObservable(this.q)
      .pipe(debounceTime(220), distinctUntilChanged(), switchMap((q) => (q.trim().length < 2 ? of(null) : this.api.products({ q: q.trim(), per_page: 5 }))))
      .subscribe((r) => this.suggestions.set(r ? r.data : null));
    // Barra de progreso solo si la navegación tarda (chunk lazy o API lenta); cierra menús al navegar.
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) { timer = setTimeout(() => this.navigating.set(true), 150); }
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        clearTimeout(timer); this.navigating.set(false); this.menu.set(false); this.mega.set(null);
        this.navError.set(e instanceof NavigationError); // casi siempre un chunk lazy que no bajó (sin red o despliegue nuevo)
      }
    });
    let last = this.cartStore.count();
    effect(() => {
      const n = this.cartStore.count();
      if (n !== last) { this.bump.set(true); setTimeout(() => this.bump.set(false), 400); }
      last = n;
    });
  }

  childrenOf(id: number) { return this.categories().filter((c) => c.parent_id === id); }

  param(name: string) {
    return this.router.url.startsWith('/productos?') ? new URLSearchParams(this.router.url.split('?')[1]).get(name) : null;
  }

  openSearch() {
    this.searchOpen.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 30);
  }
  onSearchBlur() { this.suggestOpen.set(false); if (!this.q()) this.searchOpen.set(false); }
  closeSearch() { this.suggestOpen.set(false); this.searchOpen.set(false); this.q.set(''); }
  search() {
    const q = this.q().trim();
    this.router.navigate(['/productos'], { queryParams: { q: q || null } });
    this.suggestOpen.set(false);
    this.searchInput()?.nativeElement.blur();
  }
}
