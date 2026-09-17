import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

// Pantalla de error de una página (API caída, chunk que no cargó). El padre decide qué hace "Reintentar".
@Component({
  selector: 'app-error-state',
  imports: [RouterLink],
  template: `
    <div class="empty" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v5M12 17.5v.5"/></svg>
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      <div class="row" style="justify-content:center">
        <button type="button" class="btn btn-primary" (click)="retry.emit()">Reintentar</button>
        <a class="btn" routerLink="/">Ir al inicio</a>
      </div>
    </div>
  `,
  styles: `svg { width: 2.5rem; height: 2.5rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; margin-bottom: 0.5rem; }`,
})
export class ErrorState {
  title = input('No pudimos cargar esto');
  message = input('Revisa tu conexión o inténtalo de nuevo en un momento.');
  retry = output<void>();
}
