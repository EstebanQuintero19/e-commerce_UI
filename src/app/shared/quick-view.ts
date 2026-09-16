import { Component, ElementRef, HostListener, Injectable, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { BuyBox } from './buy-box';
import { ProductImageComponent } from './product-image';
import { productBadges } from './badges';

@Injectable({ providedIn: 'root' })
export class QuickViewService {
  readonly product = signal<Product | null>(null);
  open(p: Product) { this.product.set(p); }
  close() { this.product.set(null); }
}

// Vista rápida desde la cuadrícula: foto + caja de compra, sin salir del listado. Se monta una vez en el shell.
@Component({
  selector: 'app-quick-view',
  imports: [RouterLink, BuyBox, ProductImageComponent],
  template: `
    @if (svc.product(); as p) {
      <div class="backdrop" (click)="svc.close()"></div>
      <div class="panel" role="dialog" aria-modal="true" [attr.aria-label]="p.name" #panel tabindex="-1">
        <button type="button" class="close" (click)="svc.close()" aria-label="Cerrar">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div class="media">
          <app-product-image [src]="p.image" [name]="p.name" [category]="p.category?.name" [color]="box.selectedColor()" [eager]="true" />
        </div>
        <div class="body">
          @if (badges(p).length) { <div class="badges">@for (b of badges(p); track b.text) { <span [class]="'b ' + b.kind">{{ b.text }}</span> }</div> }
          <h2>{{ p.name }}</h2>
          <app-buy-box #box [product]="p" (added)="svc.close()" />
          <a class="full" [routerLink]="['/productos', p.id]" (click)="svc.close()">Ver todos los detalles</a>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 40; }
    .panel {
      position: fixed; z-index: 41; background: var(--paper); left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(920px, calc(100vw - 2rem)); max-height: calc(100vh - 2rem); overflow: auto;
      display: grid; grid-template-columns: 1fr; outline: none;
    }
    @media (min-width: 760px) { .panel { grid-template-columns: 5fr 6fr; } }
    .media app-product-image { height: 100%; }
    .body { padding: 2rem; position: relative; }
    .body h2 { font-size: 1.4286rem; margin-bottom: 0.5rem; }
    .badges { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; }
    .b { padding: 0.2rem 0.5rem; font-size: 0.7857rem; font-weight: 500; background: var(--wash); }
    .b.editorial { background: var(--ink); color: var(--paper); }
    .b.low { color: var(--warn-ink); }
    .b.out { color: var(--ink-2); }
    .full { display: inline-block; margin-top: 1.5rem; }
    .close { position: absolute; right: 0.5rem; top: 0.5rem; z-index: 1; width: 2.5rem; height: 2.5rem; border: 0; background: var(--paper); cursor: pointer; display: grid; place-items: center; }
    .close svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
    @media (prefers-reduced-motion: no-preference) {
      .backdrop { animation: fade 160ms ease-out; }
      .panel { animation: rise 220ms var(--ease); }
      @keyframes fade { from { opacity: 0; } }
      @keyframes rise { from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); } }
    }
  `,
})
export class QuickView {
  protected svc = inject(QuickViewService);
  protected badges = productBadges;
  private panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      const open = !!this.svc.product();
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) setTimeout(() => this.panel()?.nativeElement.focus(), 30);
    });
  }

  @HostListener('document:keydown.escape') onEsc() { this.svc.close(); }
}
