import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ApiService } from '../core/api.service';
import { CartStore } from '../core/cart.store';
import { Product, Variant } from '../core/models';
import { swatch } from './product-image';
import { CopPipe, ToastService, errorMessage } from './ui';

// Selección de color/talla/cantidad y "Agregar a la bolsa". Lo usan el detalle y la vista rápida.
@Component({
  selector: 'app-buy-box',
  imports: [CopPipe],
  template: `
    <div class="price-row">
      <span class="price price-lg">{{ (variant()?.price ?? minPrice()) | cop }}</span>
      <span class="muted small">IVA incluido</span>
    </div>

    <div class="opt">
      <div class="opt-head"><span>Color</span><span class="muted">{{ color() }}</span></div>
      <div class="swatches" role="radiogroup" aria-label="Color">
        @for (c of colors(); track c) {
          <button type="button" role="radio" [attr.aria-checked]="color() === c" [class.on]="color() === c" [class.off]="!colorHasStock(c)"
            [style.background]="swatch(c)" (click)="color.set(c)" [attr.aria-label]="c" [title]="c"></button>
        }
      </div>
    </div>

    <div class="opt">
      <div class="opt-head">
        <span>Talla</span>
        @if (variant(); as v) {
          <span class="small" [class.muted]="v.available > 3" [class.low]="v.available > 0 && v.available <= 3" [class.out]="v.available === 0">
            @if (v.available === 0) { Agotada } @else if (v.available <= 3) { Quedan {{ v.available }} } @else { Disponible }
          </span>
        }
      </div>
      <div class="chips sizes" role="radiogroup" aria-label="Talla">
        @for (s of sizes(); track s) {
          <button type="button" role="radio" class="chip" [attr.aria-checked]="size() === s" [class.on]="size() === s" [disabled]="!sizeHasStock(s)" (click)="size.set(s)">{{ s }}</button>
        }
      </div>
    </div>

    <div class="actions">
      <div class="qty" aria-label="Cantidad">
        <button type="button" (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" aria-label="Menos">−</button>
        <span>{{ qty() }}</span>
        <button type="button" (click)="qty.set(qty() + 1)" [disabled]="!variant() || qty() >= variant()!.available" aria-label="Más">+</button>
      </div>
      <button type="button" class="btn btn-primary add" [class.done]="addedFlag()" [disabled]="!variant() || variant()!.available === 0 || adding()" (click)="add()">
        @if (addedFlag()) { Agregado a la bolsa } @else if (adding()) { Agregando… } @else { Agregar a la bolsa }
      </button>
    </div>
  `,
  styles: `
    .price-row { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 1.75rem; }
    .opt { margin-bottom: 1.5rem; }
    .opt-head { display: flex; justify-content: space-between; margin-bottom: 0.6rem; }
    .low { color: var(--warn-ink); }
    .out { color: var(--alert); }
    .swatches { display: flex; gap: 0.6rem; }
    .swatches button {
      width: 1.8571rem; height: 1.8571rem; border-radius: 999px; border: 1px solid var(--line-2); cursor: pointer; padding: 0;
      outline-offset: 3px; box-shadow: 0 0 0 2px var(--paper); transition: box-shadow var(--t) var(--ease);
    }
    .swatches button.on { box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px var(--ink); }
    .swatches button.off { opacity: 0.4; }
    .sizes .chip { min-width: 3.5714rem; }
    .actions { display: flex; gap: 0.5rem; margin-block: 0.5rem 0; }
    .add { flex: 1; height: 2.7143rem; padding-block: 0; }
    .add.done { background: var(--ok); border-color: var(--ok); }
  `,
})
export class BuyBox {
  private api = inject(ApiService);
  private cartStore = inject(CartStore);
  private toast = inject(ToastService);

  product = input.required<Product>();
  added = output<Variant>();

  protected size = signal<string | null>(null);
  protected color = signal<string | null>(null);
  protected qty = signal(1);
  protected adding = signal(false);
  protected addedFlag = signal(false);
  protected swatch = swatch;

  protected variants = computed(() => this.product().variants ?? []);
  // Tallas en orden de prenda, no en el orden en que se crearon las variantes.
  protected sizes = computed(() => {
    const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return [...new Set(this.variants().map((v) => v.size ?? '—'))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b, undefined, { numeric: true }));
  });
  protected colors = computed(() => [...new Set(this.variants().map((v) => v.color ?? '—'))]);
  protected variant = computed<Variant | undefined>(() =>
    this.variants().find((v) => (v.size ?? '—') === this.size() && (v.color ?? '—') === this.color()),
  );
  protected minPrice = computed(() => Math.min(...this.variants().map((v) => v.price)));
  // El detalle usa el color elegido para teñir la silueta cuando no hay foto.
  readonly selectedColor = this.color.asReadonly();

  constructor() {
    // Preselecciona la primera combinación con stock cada vez que cambia el producto.
    effect(() => {
      const first = this.variants().find((v) => v.available > 0) ?? this.variants()[0];
      untracked(() => { this.size.set(first?.size ?? '—'); this.color.set(first?.color ?? '—'); });
    });
    effect(() => { this.variant(); untracked(() => this.qty.set(1)); });
  }

  sizeHasStock(s: string) { return this.variants().some((v) => (v.size ?? '—') === s && (v.color ?? '—') === this.color() && v.available > 0); }
  colorHasStock(c: string) { return this.variants().some((v) => (v.color ?? '—') === c && v.available > 0); }

  add() {
    const v = this.variant();
    if (!v) return;
    this.adding.set(true);
    this.api.addToCart(v.id, this.qty()).subscribe({
      next: (cart) => {
        this.cartStore.set(cart);
        this.cartStore.drawerOpen.set(true);
        this.adding.set(false);
        this.addedFlag.set(true);
        setTimeout(() => this.addedFlag.set(false), 1800);
        this.added.emit(v);
      },
      error: (e) => { this.adding.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
