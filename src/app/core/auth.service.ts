import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthToken, User, Wrapped } from './models';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly user = signal<User | null>(this.read<User>(USER_KEY));
  readonly token = signal<string | null>(this.read<string>(TOKEN_KEY));
  readonly isLoggedIn = computed(() => this.token() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  login(email: string, password: string) {
    return this.http.post<AuthToken>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(tap((r) => this.store(r)));
  }

  register(name: string, email: string, password: string, password_confirmation: string) {
    return this.http
      .post<AuthToken>(`${environment.apiUrl}/auth/register`, { name, email, password, password_confirmation })
      .pipe(tap((r) => this.store(r)));
  }

  logout() {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(tap({ next: () => this.clear(), error: () => this.clear() }));
  }

  me() {
    return this.http.get<Wrapped<User>>(`${environment.apiUrl}/auth/me`).pipe(tap((r) => this.user.set(r.data)));
  }

  // Llamado por el interceptor cuando el backend responde 401 (token vencido o revocado).
  clear() {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private store(r: AuthToken) {
    this.token.set(r.token);
    this.user.set(r.user);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(r.token));
    localStorage.setItem(USER_KEY, JSON.stringify(r.user));
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}
