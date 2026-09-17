import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { guestCartToken } from './guest';
import { GuestOrders } from './guest-orders';

// Sesión en cookie HttpOnly (Sanctum SPA): las peticiones a nuestra API van con credenciales y, si escriben, con el
// token CSRF que Laravel deja en la cookie XSRF-TOKEN. Nada de esto viaja a otros hosts. 401 con sesión → limpia y a /login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);
  const orderTokens = inject(GuestOrders).header();

  const send = (r: HttpRequest<unknown>) => {
    const xsrf = xsrfToken();
    return next(r.clone({
      withCredentials: true,
      setHeaders: {
        Accept: 'application/json', 'X-Cart-Token': guestCartToken(),
        ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}), ...(orderTokens ? { 'X-Order-Tokens': orderTokens } : {}),
      },
    }));
  };
  const csrf = () => http.get(CSRF_URL, { withCredentials: true });
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

  return (mutating && !xsrfToken() ? csrf().pipe(switchMap(() => send(req))) : send(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 419) return csrf().pipe(switchMap(() => send(req))); // token CSRF vencido: uno nuevo y un reintento
      if (err.status === 401 && auth.isLoggedIn()) {
        auth.clear();
        router.navigate(['/login'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

const CSRF_URL = environment.apiUrl.replace(/\/api\/v1$/, '') + '/sanctum/csrf-cookie';

function xsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function isApiUrl(url: string): boolean {
  const base = environment.apiUrl;
  if (base.startsWith('/')) return url.startsWith(base) && !url.startsWith('//'); // mismo origen (producción)
  return url.startsWith(base.endsWith('/') ? base : base + '/');
}
