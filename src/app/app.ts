import { Component, afterNextRender, inject } from '@angular/core';
import { AuthService } from './core/auth.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    // Con usuario cacheado, el rol y los datos se confirman con la API (un 401 limpia la sesión en el interceptor).
    const auth = inject(AuthService);
    if (auth.isLoggedIn()) auth.me().subscribe({ error: () => undefined });
    // Retira la pantalla de carga de index.html una vez pintada la primera vista.
    afterNextRender(() => {
      document.documentElement.classList.add('ready');
      setTimeout(() => document.getElementById('splash')?.remove(), 400);
    });
  }
}
