import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { guestCartToken } from './guest';

// Cabeceras de sesión SOLO hacia nuestra API: el bearer y el token de carrito no deben viajar a ningún otro host.
// 401 con token → sesión limpia y a /login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Cart-Token': guestCartToken(),
    },
  });

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token) {
        auth.clear();
        router.navigate(['/login'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

function isApiUrl(url: string): boolean {
  const base = environment.apiUrl;
  if (base.startsWith('/')) return url.startsWith(base) && !url.startsWith('//'); // mismo origen (producción)
  return url.startsWith(base.endsWith('/') ? base : base + '/');
}
