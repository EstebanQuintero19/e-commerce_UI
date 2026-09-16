import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Gender, OrderStatus, PaymentStatus } from '../core/models';

// ---- Moneda COP sin decimales: "$ 49.900" ----
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Pipe({ name: 'cop' })
export class CopPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : cop.format(value);
  }
}

// ---- Toasts ----
export interface Toast { id: number; text: string; kind: 'info' | 'ok' | 'err'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'info') {
    const id = ++this.seq;
    this.items.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.items.update((t) => t.filter((x) => x.id !== id)), 3500);
  }
  ok(text: string) { this.show(text, 'ok'); }
  error(text: string) { this.show(text, 'err'); }
}

// ---- Errores HTTP → mensaje o errores de formulario (422 de Laravel) ----
export function errorMessage(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor.';
    if (err.status === 422 && err.error?.errors) return Object.values<string[]>(err.error.errors)[0]?.[0] ?? fallback;
    if (err.status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en un momento.';
    if (err.status === 429) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
    const msg = err.error?.message;
    return typeof msg === 'string' && msg.length <= 300 ? msg : fallback;
  }
  return fallback;
}

// Marca cada control con el primer error que devolvió la API; devuelve true si aplicó alguno.
export function applyFormErrors(form: FormGroup, err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse) || err.status !== 422 || !err.error?.errors) return false;
  for (const [field, messages] of Object.entries<string[]>(err.error.errors)) {
    form.get(field)?.setErrors({ api: messages[0] });
  }
  return true;
}

export function fieldError(form: FormGroup, name: string): string | null {
  const c = form.get(name);
  if (!c || !c.errors || !(c.touched || c.dirty)) return null;
  if (c.errors['api']) return c.errors['api'];
  if (c.errors['required']) return 'Este campo es obligatorio';
  if (c.errors['email']) return 'Escribe un correo válido';
  if (c.errors['minlength']) return `Mínimo ${c.errors['minlength'].requiredLength} caracteres`;
  if (c.errors['min']) return `Mínimo ${c.errors['min'].min}`;
  if (c.errors['max']) return `Máximo ${c.errors['max'].max}`;
  return 'Revisa este campo';
}

export const GENDER_LABEL: Record<Gender, string> = { mujer: 'Mujer', hombre: 'Hombre', unisex: 'Unisex' };

// ---- Etiquetas de estado en español ----
export const ORDER_STATUS: Record<OrderStatus, { label: string; badge: string }> = {
  pending: { label: 'Pendiente de pago', badge: 'badge-warn' },
  paid: { label: 'Pagado', badge: 'badge-ok' },
  shipped: { label: 'Enviado', badge: 'badge-info' },
  delivered: { label: 'Entregado', badge: 'badge-ok' },
  cancelled: { label: 'Cancelado', badge: 'badge' },
  return_requested: { label: 'Devolución solicitada', badge: 'badge-warn' },
  refunded: { label: 'Reembolsado', badge: 'badge' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; badge: string }> = {
  pending: { label: 'Pendiente', badge: 'badge-warn' },
  succeeded: { label: 'Aprobado', badge: 'badge-ok' },
  failed: { label: 'Rechazado', badge: 'badge-err' },
  refund_required: { label: 'Reembolso pendiente', badge: 'badge-err' },
  refunded: { label: 'Reembolsado', badge: 'badge' },
};

export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
