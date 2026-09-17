import { Injectable } from '@angular/core';

// Pedidos hechos sin cuenta: el token que devolvió la API al crearlos (o el del enlace del correo) se guarda en este
// navegador y viaja en X-Order-Tokens para ver y pagar esos pedidos.
// ponytail: se mandan todos los tokens en cada petición; con decenas de pedidos de invitado habría que mandar solo el de la orden en uso.
@Injectable({ providedIn: 'root' })
export class GuestOrders {
  private static KEY = 'guest_orders';

  remember(orderId: number, token: string) {
    try { localStorage.setItem(GuestOrders.KEY, JSON.stringify({ ...this.all(), [orderId]: token })); } catch { /* sin storage no se recuerda; el enlace del correo sigue sirviendo */ }
  }

  header(): string {
    return Object.values(this.all()).join(',');
  }

  private all(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(GuestOrders.KEY) ?? '{}'); } catch { return {}; }
  }
}
