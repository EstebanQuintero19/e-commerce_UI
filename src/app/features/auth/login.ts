import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { safeInternalPath } from '../../core/safe-url';
import { ToastService, applyFormErrors, errorMessage, fieldError } from '../../shared/ui';
import { PageMeta } from '../../shared/seo';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth">
      <h1>Iniciar sesión</h1>
      <p class="muted">¿Primera vez? <a routerLink="/registro" [queryParams]="{ redirect: redirect() }">Crea tu cuenta</a></p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="email">Correo</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" maxlength="200" [class.invalid]="err('email')" />
          @if (err('email'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" maxlength="200" [class.invalid]="err('password')" />
          @if (err('password'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <button class="btn btn-primary btn-block" [disabled]="busy()">{{ busy() ? "Entrando…" : "Iniciar sesión" }}</button>
      </form>
      <p style="margin-top:1.25rem"><button type="button" class="link-btn muted" (click)="forgot()" [disabled]="busy()">Olvidé mi contraseña</button></p>
      @if (sent()) { <div class="alert alert-ok">Si el correo existe, te enviamos un enlace para restablecerla.</div> }
    </div>
  `,
  styles: `.auth { max-width: 400px; margin: 3rem auto; } .auth h1 { margin-bottom: 0.25rem; } .auth .btn-block { margin-top: 0.5rem; }`,
})
export class Login {
  constructor() { inject(PageMeta).set('Iniciar sesión'); }
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  redirect = input<string>();
  protected busy = signal(false);
  protected sent = signal(false);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  err(name: string) { return fieldError(this.form, name); }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(safeInternalPath(this.redirect(), '/productos')),
      error: (e) => { this.busy.set(false); applyFormErrors(this.form, e) || this.toast.error(errorMessage(e)); },
    });
  }

  forgot() {
    const email = this.form.controls.email.value;
    if (!email) { this.form.controls.email.markAsTouched(); return; }
    this.busy.set(true);
    this.api.forgotPassword(email).subscribe({
      next: () => { this.busy.set(false); this.sent.set(true); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
