import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PageMeta } from '../../shared/seo';

// 404: la camiseta del splash colgada de un gancho, con la talla "404" en la etiqueta. Se reutiliza para producto/pedido inexistente.
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="nf">
      <div class="hanger" aria-hidden="true">
        <svg viewBox="0 0 300 420">
          <path class="hook" d="M150 4c-12 0-18 8-18 16s6 12 12 16c8 5 6 12 6 16" />
          <path class="bar" d="M150 52 36 106h228z" />
          <path class="shirt" d="M118 104c16 18 48 18 64 0l56 20 40 60-46 28-14-18v190H82V194l-14 18-46-28 40-60z" />
          <path class="neck" d="M120 106c14 28 46 28 60 0" />
          <text x="150" y="262" class="size">404</text>
          <text x="150" y="296" class="tag" textLength="118" lengthAdjust="spacingAndGlyphs">TALLA ÚNICA · AGOTADA</text>
        </svg>
      </div>
      <h1>{{ title() || 'Esta página se agotó' }}</h1>
      <p>{{ text() || 'Buscamos en todas las tallas y colores y no la encontramos. Puede que se haya vendido o que nunca haya existido.' }}</p>
      <form class="search" (ngSubmit)="search()" role="search">
        <input type="search" name="q" [(ngModel)]="q" placeholder="Busca una prenda" aria-label="Buscar productos" maxlength="80" />
        <button type="submit" class="btn btn-primary">Buscar</button>
      </form>
      <div class="row" style="justify-content:center">
        <a class="btn" routerLink="/">Ir al inicio</a>
        <a class="btn" routerLink="/productos" [queryParams]="{ badge: 'Nuevo' }">Ver novedades</a>
      </div>
    </div>
  `,
  styles: `
    .nf { text-align: center; padding: 3rem 1rem 4rem; max-width: 40ch; margin-inline: auto; color: var(--ink-2); display: grid; gap: 1rem; justify-items: center; }
    h1 { color: var(--ink); margin: 0; }
    p { margin: 0; }
    .hanger { width: 180px; transform-origin: 50% 0; }
    .hanger svg { width: 100%; display: block; fill: none; stroke: var(--ink); stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
    .hook, .bar { stroke-width: 3; }
    .shirt { fill: var(--paper); }
    .neck { stroke-width: 3; }
    text { fill: var(--ink); stroke: none; text-anchor: middle; font-family: var(--font); font-weight: 700; }
    .size { font-size: 64px; letter-spacing: -0.04em; }
    .tag { font-size: 12px; letter-spacing: 0.06em; fill: var(--ink-2); }
    .search { display: flex; gap: 0.5rem; width: 100%; max-width: 22rem; }
    .search input { flex: 1; min-width: 0; }
    @media (prefers-reduced-motion: no-preference) {
      .hanger { animation: sway 3.2s var(--ease) infinite; }
      .hanger:hover { animation-duration: 0.8s; }
      @keyframes sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
    }
  `,
})
export class NotFound {
  private router = inject(Router);
  // Como ruta (`**`) withComponentInputBinding deja los inputs en undefined: el texto por defecto va en la plantilla.
  title = input<string>();
  text = input<string>();
  protected q = '';

  constructor() {
    inject(PageMeta).set('Página no encontrada');
  }

  search() {
    const q = this.q.trim();
    if (q) this.router.navigate(['/productos'], { queryParams: { q } });
  }
}
