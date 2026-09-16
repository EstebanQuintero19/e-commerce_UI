import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CartStore } from '../core/cart.store';
import { ToastService } from '../shared/ui';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="hdr">
      <div class="container hdr-in">
        <a routerLink="/" class="brand" aria-label="Mi Tienda, inicio">
          <span class="brand-mark"></span>Mi Tienda
        </a>
        <form class="search" (ngSubmit)="search()" role="search">
          <input class="input" type="search" name="q" [(ngModel)]="q" placeholder="Buscar camisetas, jeans, chaquetas…" aria-label="Buscar productos" />
        </form>
        <nav class="nav" aria-label="Principal">
          <a routerLink="/productos" routerLinkActive="on">Tienda</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/pedidos" routerLinkActive="on">Pedidos</a>
            <a routerLink="/cuenta" routerLinkActive="on">Cuenta</a>
            @if (auth.isAdmin()) { <a routerLink="/admin" routerLinkActive="on">Admin</a> }
          } @else {
            <a routerLink="/login" routerLinkActive="on">Entrar</a>
          }
          <a routerLink="/carrito" routerLinkActive="on" class="cart-link" aria-label="Carrito">
            Carrito @if (cartStore.count() > 0) { <span class="cart-n">{{ cartStore.count() }}</span> }
          </a>
        </nav>
        <button type="button" class="menu-btn" (click)="open.set(!open())" aria-label="Menú">☰</button>
      </div>
      @if (open()) {
        <nav class="nav-m container" (click)="open.set(false)">
          <a routerLink="/productos">Tienda</a>
          <a routerLink="/carrito">Carrito ({{ cartStore.count() }})</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/pedidos">Pedidos</a>
            <a routerLink="/cuenta">Cuenta</a>
            @if (auth.isAdmin()) { <a routerLink="/admin">Admin</a> }
          } @else {
            <a routerLink="/login">Entrar</a>
          }
        </nav>
      }
    </header>

    <main class="container page"><router-outlet /></main>

    <footer class="ftr container">
      <span>Mi Tienda S.A.S. · Ropa de algodón hecha en Colombia</span>
      <span class="muted">Precios en pesos colombianos con IVA incluido</span>
    </footer>

    <div class="toasts" aria-live="polite">
      @for (t of toast.items(); track t.id) { <div class="toast" [class.toast-err]="t.kind === 'err'" [class.toast-ok]="t.kind === 'ok'">{{ t.text }}</div> }
    </div>
  `,
  styles: `
    .hdr { background: var(--indigo); color: #fff; position: sticky; top: 0; z-index: 20; }
    .hdr-in { display: flex; align-items: center; gap: 1.5rem; height: 3.75rem; }
    .brand { color: #fff; text-decoration: none; font-weight: 700; font-size: 1.125rem; letter-spacing: -0.02em; display: inline-flex; align-items: center; gap: 0.5rem; }
    .brand-mark { width: 0.9rem; height: 0.9rem; background: var(--thread); border-radius: 2px; display: inline-block; }
    .search { flex: 1; max-width: 460px; }
    .search .input { border-color: transparent; background: rgba(255,255,255,0.12); color: #fff; padding-block: 0.5rem; }
    .search .input::placeholder { color: rgba(255,255,255,0.65); }
    .search .input:focus { background: #fff; color: var(--ink); box-shadow: none; }
    .nav { margin-left: auto; display: flex; gap: 1.25rem; align-items: center; }
    .nav a { color: rgba(255,255,255,0.85); text-decoration: none; padding-block: 0.25rem; border-bottom: 2px solid transparent; }
    .nav a:hover, .nav a.on { color: #fff; border-bottom-color: var(--thread); }
    .cart-n { background: var(--thread); color: #1a1205; border-radius: 999px; padding: 0 0.45rem; font-size: 0.8rem; font-weight: 700; margin-left: 0.25rem; }
    .menu-btn { display: none; margin-left: auto; font: inherit; background: none; border: 0; color: #fff; font-size: 1.4rem; cursor: pointer; }
    .nav-m { display: grid; gap: 0.25rem; padding-block: 0.5rem 1rem; }
    .nav-m a { color: #fff; text-decoration: none; padding: 0.5rem 0; }
    .ftr { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-block: 1.5rem 2rem; border-top: 1px solid var(--line); font-size: 0.875rem; }
    @media (max-width: 760px) {
      .nav, .search { display: none; }
      .menu-btn { display: block; }
    }
  `,
})
export class Shell {
  protected auth = inject(AuthService);
  protected cartStore = inject(CartStore);
  protected toast = inject(ToastService);
  private router = inject(Router);
  protected open = signal(false);
  protected q = '';

  search() {
    this.router.navigate(['/productos'], { queryParams: { q: this.q || null } });
  }
}
