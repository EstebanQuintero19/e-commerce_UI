import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CartStore } from '../../core/cart.store';
import { Product, Variant } from '../../core/models';
import { CopPipe, ToastService, errorMessage } from '../../shared/ui';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, CopPipe],
  template: `
    @if (product(); as p) {
      <p><a routerLink="/productos" [queryParams]="{ category_id: p.category?.id }">{{ p.category?.name }}</a></p>
      <div class="two-col">
        <section class="gallery">
          <div class="main">
            @if (mainImage(); as img) { <img [src]="img" [alt]="p.name" /> } @else { <div class="ph">{{ p.name.slice(0, 1) }}</div> }
          </div>
          @if (p.images.length > 1) {
            <div class="thumbs">
              @for (img of p.images; track img.id) {
                <button type="button" [class.on]="mainImage() === img.url" (click)="mainImage.set(img.url)"><img [src]="img.url" alt="" /></button>
              }
            </div>
          }
        </section>

        <section class="card sticky buy">
          <h1>{{ p.name }}</h1>
          @if (p.description) { <p class="muted">{{ p.description }}</p> }

          <div class="price">
            <span class="tag tag-lg">{{ (variant()?.price ?? minPrice()) | cop }}</span>
            @if (variant(); as v) {
              <span class="muted small">
                @if (v.available === 0) { Agotada } @else if (v.available <= 3) { Quedan {{ v.available }} } @else { Disponible }
              </span>
            }
          </div>

          <div class="field">
            <label>Talla</label>
            <div class="chips">
              @for (s of sizes(); track s) {
                <button type="button" class="chip" [class.on]="size() === s" [disabled]="!sizeHasStock(s)" (click)="size.set(s)">{{ s }}</button>
              }
            </div>
          </div>
          <div class="field">
            <label>Color</label>
            <div class="chips">
              @for (c of colors(); track c) {
                <button type="button" class="chip" [class.on]="color() === c" [disabled]="!colorHasStock(c)" (click)="color.set(c)">{{ c }}</button>
              }
            </div>
          </div>

          <div class="row" style="margin-top:0.5rem">
            <div class="qty" aria-label="Cantidad">
              <button type="button" (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" aria-label="Menos">−</button>
              <span>{{ qty() }}</span>
              <button type="button" (click)="qty.set(qty() + 1)" [disabled]="!variant() || qty() >= variant()!.available" aria-label="Más">+</button>
            </div>
            <button type="button" class="btn btn-primary" style="flex:1" [disabled]="!variant() || variant()!.available === 0 || adding()" (click)="add()">
              {{ added() ? 'Agregado' : 'Agregar al carrito' }}
            </button>
          </div>
          @if (variant(); as v) { <p class="muted small" style="margin-top:0.75rem">Referencia {{ v.sku }}</p> }
        </section>
      </div>
    } @else if (notFound()) {
      <div class="empty"><h2>Este producto ya no está disponible</h2><a class="btn" routerLink="/productos">Volver a la tienda</a></div>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: `
    .main { aspect-ratio: 4 / 5; background: #e9ebe6; border-radius: var(--radius); overflow: hidden; }
    .main img { width: 100%; height: 100%; object-fit: cover; }
    .ph { width: 100%; height: 100%; display: grid; place-items: center; font-size: 6rem; font-weight: 700; color: #c5c9c0; }
    .thumbs { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .thumbs button { width: 64px; height: 80px; padding: 0; border: 2px solid transparent; border-radius: var(--radius); overflow: hidden; background: none; cursor: pointer; }
    .thumbs button.on { border-color: var(--indigo); }
    .thumbs img { width: 100%; height: 100%; object-fit: cover; }
    .buy h1 { font-size: 1.6rem; }
    .price { display: flex; align-items: baseline; gap: 0.75rem; margin: 1rem 0 1.25rem; }
    .small { font-size: 0.875rem; }
  `,
})
export class ProductDetail {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private cartStore = inject(CartStore);
  private toast = inject(ToastService);
  private router = inject(Router);

  id = input.required<string>();

  protected product = signal<Product | null>(null);
  protected notFound = signal(false);
  protected mainImage = signal<string | null>(null);
  protected size = signal<string | null>(null);
  protected color = signal<string | null>(null);
  protected qty = signal(1);
  protected adding = signal(false);
  protected added = signal(false);

  protected variants = computed(() => this.product()?.variants ?? []);
  protected sizes = computed(() => [...new Set(this.variants().map((v) => v.size ?? '—'))]);
  protected colors = computed(() => [...new Set(this.variants().filter((v) => !this.size() || (v.size ?? '—') === this.size()).map((v) => v.color ?? '—'))]);
  protected variant = computed<Variant | undefined>(() =>
    this.variants().find((v) => (v.size ?? '—') === this.size() && (v.color ?? '—') === this.color()),
  );
  protected minPrice = computed(() => Math.min(...this.variants().map((v) => v.price)));

  constructor() {
    toObservable(this.id)
      .pipe(switchMap((id) => this.api.product(Number(id))))
      .subscribe({
        next: (p) => {
          this.product.set(p);
          this.mainImage.set(p.image);
          // Preselecciona la primera combinación con stock.
          const first = p.variants?.find((v) => v.available > 0) ?? p.variants?.[0];
          this.size.set(first?.size ?? '—');
          this.color.set(first?.color ?? '—');
        },
        error: () => this.notFound.set(true),
      });
    // Si cambia la talla y el color elegido no existe en esa talla, toma el primero con stock.
    effect(() => {
      const colors = this.colors();
      untracked(() => {
        if (this.color() && !colors.includes(this.color()!)) this.color.set(colors[0] ?? null);
        this.qty.set(1);
      });
    });
  }

  sizeHasStock(s: string) { return this.variants().some((v) => (v.size ?? '—') === s && v.available > 0); }
  colorHasStock(c: string) { return this.variants().some((v) => (v.size ?? '—') === this.size() && (v.color ?? '—') === c && v.available > 0); }

  add() {
    const v = this.variant();
    if (!v) return;
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    this.adding.set(true);
    this.api.addToCart(v.id, this.qty()).subscribe({
      next: (cart) => {
        this.cartStore.set(cart);
        this.adding.set(false);
        this.added.set(true);
        setTimeout(() => this.added.set(false), 1800);
        this.toast.ok(`${this.product()!.name} agregado al carrito`);
      },
      error: (e) => { this.adding.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
