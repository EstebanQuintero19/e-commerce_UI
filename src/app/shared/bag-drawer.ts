import { Component, HostListener, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CartStore } from '../core/cart.store';
import { CartItem } from '../core/models';
import { ProductImageComponent } from './product-image';
import { CopPipe, ToastService, errorMessage } from './ui';

// Mini-bolsa lateral: se abre al agregar un producto, deja seguir comprando o ir a pagar sin cambiar de página.
@Component({
  selector: 'app-bag-drawer',
  imports: [RouterLink, CopPipe, ProductImageComponent],
  template: `
    @if (store.drawerOpen()) {
      <div class="backdrop" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Tu bolsa">
        <header>
          <h2>Tu bolsa <span class="muted">{{ store.count() }}</span></h2>
          <button type="button" class="close" (click)="close()" aria-label="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        @if (store.cart(); as cart) {
          @if (cart.items.length === 0) {
            <p class="empty-msg muted">Tu bolsa está vacía.</p>
          } @else {
            <ul class="items">
              @for (item of cart.items; track item.id) {
                <li>
                  <a [routerLink]="['/productos', item.product_id]" (click)="close()" class="thumb">
                    <app-product-image [src]="item.image" [name]="item.product_name" [category]="item.category" [color]="item.color" />
                  </a>
                  <div class="info">
                    <a [routerLink]="['/productos', item.product_id]" (click)="close()">{{ item.product_name }}</a>
                    <span class="muted small">{{ [item.color, item.size].join(' · ') }} · × {{ item.quantity }}</span>
                    <span class="price">{{ item.line_total | cop }}</span>
                  </div>
                  <button type="button" class="remove" (click)="remove(item)" aria-label="Quitar">
                    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                </li>
              }
            </ul>
            <footer>
              <div class="total"><span>Subtotal</span><span class="price">{{ cart.subtotal - cart.discount | cop }}</span></div>
              <p class="muted small">IVA incluido en el total. Envío según tu dirección.</p>
              <a class="btn btn-primary btn-block" routerLink="/checkout" (click)="close()">Ir a pagar</a>
              <a class="btn btn-block" routerLink="/carrito" (click)="close()">Ver bolsa</a>
            </footer>
          }
        }
      </aside>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 40; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 100vw); background: var(--paper); z-index: 41;
      display: grid; grid-template-rows: auto 1fr auto; box-shadow: -12px 0 32px -16px rgba(0, 0, 0, 0.3);
    }
    header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--line); }
    header h2 { margin: 0; font-size: 1.1429rem; }
    header .muted { font-weight: 400; margin-left: 0.25rem; }
    .close, .remove { border: 0; background: none; cursor: pointer; width: 2.25rem; height: 2.25rem; display: grid; place-items: center; }
    .close svg, .remove svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
    .remove { color: var(--ink-2); }
    .remove:hover { color: var(--ink); }
    .empty-msg { padding: 2rem 1.25rem; }
    .items { list-style: none; margin: 0; padding: 0.5rem 1.25rem; overflow: auto; }
    .items li { display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 0.9rem; padding-block: 0.9rem; border-bottom: 1px solid var(--line); align-items: start; }
    .thumb { width: 4.5rem; }
    .info { display: grid; gap: 0.15rem; }
    .info a { text-decoration: none; font-weight: 500; }
    .info a:hover { text-decoration: underline; }
    footer { padding: 1rem 1.25rem 1.25rem; border-top: 1px solid var(--line); display: grid; gap: 0.5rem; }
    .total { display: flex; justify-content: space-between; font-weight: 600; font-size: 1.0714rem; }
    footer p { margin: 0; }
    @media (prefers-reduced-motion: no-preference) {
      .backdrop { animation: fade 160ms ease-out; }
      .drawer { animation: slide 260ms var(--ease); }
      @keyframes fade { from { opacity: 0; } }
      @keyframes slide { from { transform: translateX(100%); } }
    }
  `,
})
export class BagDrawer {
  protected store = inject(CartStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  constructor() {
    effect(() => { document.body.style.overflow = this.store.drawerOpen() ? 'hidden' : ''; });
    // En la página de la bolsa o el checkout no tiene sentido el panel.
    effect(() => { if (this.store.drawerOpen() && /^\/(carrito|checkout)/.test(this.router.url)) this.store.drawerOpen.set(false); });
  }

  close() { this.store.drawerOpen.set(false); }

  remove(item: CartItem) {
    this.api.removeCartItem(item.id).subscribe({ next: (c) => this.store.set(c), error: (e) => this.toast.error(errorMessage(e)) });
  }

  @HostListener('document:keydown.escape') onEsc() { this.close(); }
}
