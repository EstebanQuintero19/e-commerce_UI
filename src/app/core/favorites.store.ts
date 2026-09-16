import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Product } from './models';

const KEY = 'favorites';

// Favoritos: en el servidor con sesión; en localStorage como invitado. Al iniciar sesión, los locales pasan al servidor.
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly ids = signal<Set<number>>(new Set(this.readLocal()));
  readonly count = computed(() => this.ids().size);
  // Productos completos, solo para la página de favoritos.
  readonly products = signal<Product[] | null>(null);

  constructor() {
    toObservable(this.auth.isLoggedIn).subscribe((logged) => (logged ? this.sync() : this.ids.set(new Set(this.readLocal()))));
  }

  has(id: number) { return this.ids().has(id); }

  toggle(product: Product) {
    const on = !this.has(product.id);
    this.ids.update((s) => { const n = new Set(s); on ? n.add(product.id) : n.delete(product.id); return n; });
    this.products.update((list) => (list ? (on ? [product, ...list.filter((p) => p.id !== product.id)] : list.filter((p) => p.id !== product.id)) : list));
    if (this.auth.isLoggedIn()) {
      (on ? this.api.addFavorite(product.id) : this.api.removeFavorite(product.id)).subscribe({ error: () => this.sync() });
    } else {
      this.writeLocal();
    }
    return on;
  }

  load() {
    if (!this.auth.isLoggedIn()) { this.products.set([]); return; }
    this.api.favorites().subscribe((r) => { this.products.set(r.data); this.ids.set(new Set(r.data.map((p) => p.id))); });
  }

  // Sube los favoritos guardados como invitado y toma la lista del servidor.
  private sync() {
    const local = this.readLocal();
    forkJoin(local.length ? local.map((id) => this.api.addFavorite(id)) : [of(null)]).subscribe({
      next: () => { this.writeLocal([]); this.load(); },
      error: () => this.load(),
    });
  }

  private readLocal(): number[] {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  }
  private writeLocal(ids: number[] = [...this.ids()]) {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* sin storage */ }
  }
}
