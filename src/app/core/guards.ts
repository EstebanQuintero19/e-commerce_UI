import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });

// El rol guardado en el navegador se puede manipular: para entrar a /admin se confirma con la API.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const home = inject(Router).createUrlTree(['/']);
  if (!auth.isLoggedIn()) return home;
  return auth.me().pipe(
    map((r) => (r.data.role === 'admin' ? true : home)),
    catchError(() => of(home)),
  );
};
