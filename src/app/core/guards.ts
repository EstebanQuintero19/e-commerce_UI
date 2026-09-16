import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });

export const adminGuard: CanActivateFn = () => (inject(AuthService).isAdmin() ? true : inject(Router).createUrlTree(['/']));
