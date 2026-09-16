import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Cart } from './models';

// Carrito en memoria para el contador de la cabecera y las pantallas; cada operación de la API lo reemplaza entero.
@Injectable({ providedIn: 'root' })
export class CartStore {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly cart = signal<Cart | null>(null);
  readonly count = computed(() => this.cart()?.items.reduce((n, i) => n + i.quantity, 0) ?? 0);

  constructor() {
    toObservable(this.auth.isLoggedIn).subscribe((logged) => (logged ? this.refresh() : this.cart.set(null)));
  }

  refresh() {
    this.api.cart().subscribe({ next: (c) => this.cart.set(c), error: () => this.cart.set(null) });
  }

  set(c: Cart) {
    this.cart.set(c);
  }
}
