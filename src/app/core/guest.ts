import { uuid } from '../shared/ui';

const KEY = 'guest_cart';

// Identifica el carrito de un visitante sin cuenta. Lo genera el navegador; el backend lo fusiona con la cuenta al iniciar sesión.
export function guestCartToken(): string {
  try {
    let t = localStorage.getItem(KEY);
    if (!t) { t = uuid(); localStorage.setItem(KEY, t); }
    return t;
  } catch {
    return uuid(); // sin storage: token efímero para esta carga
  }
}

// Tras iniciar sesión el carrito de invitado ya se fusionó: el siguiente visitante anónimo empieza de cero.
export function rotateGuestCartToken(): void {
  try { localStorage.setItem(KEY, uuid()); } catch { /* sin storage */ }
}
