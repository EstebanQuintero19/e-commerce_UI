import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Cart } from './models';

// Bolsa en memoria para el contador de la cabecera y las pantallas; cada operación de la API la reemplaza entera.
// Funciona con sesión o como invitado (X-Cart-Token en el interceptor).
@Injectable({ providedIn: 'root' })
export class CartStore {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly cart = signal<Cart | null>(null);
  readonly count = computed(() => this.cart()?.items.reduce((n, i) => n + i.quantity, 0) ?? 0);
  // Se abre al agregar; lo cierra el cliente.
  readonly drawerOpen = signal(false);

  constructor() {
    toObservable(this.auth.isLoggedIn).subscribe(() => {
      this.api.invalidateCatalog(); // admin ve stock e inactivos: lo cacheado como anónimo no sirve
      this.refresh();
    });
  }

  refresh() {
    this.api.cart().subscribe({ next: (c) => this.cart.set(c), error: () => this.cart.set(null) });
  }

  set(c: Cart) {
    this.cart.set(c);
  }
}
