import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin">
      <nav class="side" aria-label="Administración">
        <a routerLink="/admin/pedidos" routerLinkActive="on">Pedidos</a>
        <a routerLink="/admin/productos" routerLinkActive="on">Productos</a>
        <a routerLink="/admin/inventario" routerLinkActive="on">Inventario</a>
        <a routerLink="/admin/cupones" routerLinkActive="on">Cupones</a>
      </nav>
      <div class="content"><router-outlet /></div>
    </div>
  `,
  styles: `
    .admin { display: grid; gap: 2rem; grid-template-columns: 1fr; }
    @media (min-width: 800px) { .admin { grid-template-columns: 180px minmax(0, 1fr); } }
    .side { display: flex; gap: 0.25rem; flex-wrap: wrap; align-content: start; }
    @media (min-width: 800px) { .side { flex-direction: column; position: sticky; top: 5rem; } }
    .side a { text-decoration: none; color: var(--ink-2); padding: 0.5rem 0.75rem; border-radius: var(--radius); border-left: 3px solid transparent; }
    .side a:hover { background: #e9ebe6; color: var(--ink); }
    .side a.on { color: var(--ink); font-weight: 500; border-left-color: var(--thread); background: var(--surface); }
  `,
})
export class AdminLayout {}
