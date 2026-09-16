import { Component, computed, input, signal } from '@angular/core';

// Siluetas en un lienzo 300x400 (3:4). Se elige por el nombre del producto; la categoría es el respaldo.
const SHAPES: Record<string, { body: string; detail?: string }> = {
  tee: {
    body: 'M120 62 C135 80 165 80 180 62 L236 82 L276 142 L230 170 L216 152 L216 346 L84 346 L84 152 L70 170 L24 142 L64 82 Z',
    detail: 'M122 64 C134 92 166 92 178 64',
  },
  vneck: {
    body: 'M120 62 C135 80 165 80 180 62 L236 82 L276 142 L230 170 L216 152 L216 346 L84 346 L84 152 L70 170 L24 142 L64 82 Z',
    detail: 'M124 64 L150 108 L176 64',
  },
  polo: {
    body: 'M120 62 C135 80 165 80 180 62 L236 82 L276 142 L230 170 L216 152 L216 346 L84 346 L84 152 L70 170 L24 142 L64 82 Z',
    detail: 'M122 62 L150 112 L178 62 M150 112 V150 M138 60 L150 78 L162 60',
  },
  longsleeve: {
    body: 'M120 62 C135 80 165 80 180 62 L236 82 L278 150 L264 262 L222 258 L216 176 L216 346 L84 346 L84 176 L78 258 L36 262 L22 150 L64 82 Z',
    detail: 'M122 64 C134 92 166 92 178 64',
  },
  hoodie: {
    body: 'M118 74 C112 34 188 34 182 74 L236 90 L278 156 L264 266 L222 262 L216 180 L216 346 L84 346 L84 180 L78 262 L36 266 L22 156 L64 90 Z',
    detail: 'M118 76 C130 100 170 100 182 76 M118 76 C124 52 176 52 182 76 M108 262 H192 V310 H108 Z M150 100 V150',
  },
  jacket: {
    body: 'M116 60 L150 74 L184 60 L238 80 L280 150 L266 264 L224 260 L218 178 L218 346 L82 346 L82 178 L76 260 L34 264 L20 150 L62 80 Z',
    detail: 'M150 74 V346 M116 60 L150 122 L184 60 M96 240 H132 V286 H96 Z M168 240 H204 V286 H168 Z',
  },
  blazer: {
    body: 'M112 58 L150 70 L188 58 L240 80 L282 152 L268 266 L226 262 L220 180 L220 346 L80 346 L80 180 L74 262 L32 266 L18 152 L60 80 Z',
    detail: 'M118 60 L150 172 L182 60 M118 60 L134 86 M182 60 L166 86 M150 172 V346 M150 196 a4 4 0 1 0 0.1 0 M94 252 H130 M170 252 H206',
  },
  bomber: {
    body: 'M120 66 C132 84 168 84 180 66 L236 84 L276 150 L262 262 L222 258 L216 176 L216 330 L84 330 L84 176 L78 258 L38 262 L24 150 L64 84 Z',
    detail: 'M120 66 C120 52 180 52 180 66 M150 84 V330 M84 312 H216 M222 244 L216 258 M78 244 L84 258 M96 236 H128 V262 H96 Z M172 236 H204 V262 H172 Z',
  },
  tank: {
    body: 'M96 58 L122 58 C122 100 136 120 150 120 C164 120 178 100 178 58 L204 58 L214 118 L214 346 L86 346 L86 118 Z',
  },
  pants: {
    body: 'M80 58 H220 L232 200 L224 348 L166 348 L153 180 H147 L134 348 L76 348 L68 200 Z',
    detail: 'M80 72 H220 M150 72 V180',
  },
  shorts: {
    body: 'M80 58 H220 L232 214 L164 218 L150 168 L136 218 L68 214 Z',
    detail: 'M80 72 H220 M150 72 V168',
  },
};

// Nombres de color del catálogo → color del trazo. Los desconocidos usan gris.
const COLORS: Record<string, string> = {
  negro: '#161616', blanco: '#ffffff', gris: '#9a9a9a', azul: '#2f4d8a', 'azul marino': '#1f2a44', rojo: '#b3261e',
  verde: '#3b6b4a', beige: '#d9c9a8', cafe: '#6b4a2e', café: '#6b4a2e', rosado: '#e7a5b5', rosa: '#e7a5b5', amarillo: '#e8c547',
  naranja: '#e07a2b', morado: '#6b4c9a', crudo: '#efe9dc', oliva: '#6b6b3a', vinotinto: '#6b1f2e',
};

export function shapeFor(name: string, category?: string | null): keyof typeof SHAPES {
  const n = name.toLowerCase();
  if (/hoodie|buzo|capota/.test(n)) return 'hoodie';
  if (/blazer|saco/.test(n)) return 'blazer';
  if (/bomber|rompevientos/.test(n)) return 'bomber';
  if (/chaqueta|abrigo|chamarra/.test(n)) return 'jacket';
  if (/esqueleto|tank|tirantes/.test(n)) return 'tank';
  if (/polo/.test(n)) return 'polo';
  if (/cuello v/.test(n)) return 'vneck';
  if (/manga larga/.test(n)) return 'longsleeve';
  if (/short|bermuda/.test(n)) return 'shorts';
  if (/jean|pantal|jogger|chino/.test(n)) return 'pants';
  const c = (category ?? '').toLowerCase();
  if (/pantal/.test(c)) return 'pants';
  if (/chaqueta|abrigo/.test(c)) return 'jacket';
  return 'tee';
}

export function swatch(color: string | null | undefined): string {
  return COLORS[(color ?? '').toLowerCase()] ?? '#bdbdbd';
}

@Component({
  selector: 'app-product-image',
  template: `
    @if (src(); as s) {
      <img [src]="s" [attr.srcset]="srcset()" [attr.sizes]="srcset() ? sizes() : null" [alt]="alt()" [attr.loading]="eager() ? 'eager' : 'lazy'" [attr.fetchpriority]="eager() ? 'high' : null" [class.ready]="loaded()" (load)="loaded.set(true)" />
    } @else {
      <svg viewBox="0 0 300 400" [attr.aria-label]="alt()" role="img">
        <g transform="translate(150 200) scale(0.7) translate(-150 -200)">
          <path [attr.d]="shape().body" [attr.fill]="fill()" [attr.stroke]="stroke()" stroke-width="2.5" stroke-linejoin="round" />
          @if (shape().detail) { <path [attr.d]="shape().detail" fill="none" [attr.stroke]="stroke()" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /> }
        </g>
      </svg>
    }
  `,
  styles: `
    :host { display: block; aspect-ratio: 3 / 4; background: var(--wash); overflow: hidden; }
    img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 260ms var(--ease); }
    img.ready { opacity: 1; }
    svg { width: 100%; height: 100%; display: block; }
  `,
})
export class ProductImageComponent {
  src = input<string | null | undefined>(null);
  srcset = input<string | null | undefined>(null);
  // Ancho que ocupa la imagen en el layout, para que el navegador elija el tamaño del srcset.
  sizes = input('(min-width: 1100px) 25vw, (min-width: 700px) 33vw, 50vw');
  name = input.required<string>();
  category = input<string | null | undefined>(null);
  color = input<string | null | undefined>(null);
  eager = input(false);

  protected loaded = signal(false);
  protected alt = computed(() => this.name());
  protected shape = computed(() => SHAPES[shapeFor(this.name(), this.category())]);
  protected fill = computed(() => swatch(this.color() ?? 'negro'));
  // Las prendas blancas necesitan contorno para no fundirse con el fondo; el resto lleva un detalle más claro.
  protected stroke = computed(() => (this.fill() === '#ffffff' ? '#c9c7c2' : 'rgba(255,255,255,0.35)'));
}
