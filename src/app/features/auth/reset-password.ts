import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService, applyFormErrors, errorMessage, fieldError } from '../../shared/ui';

// Llega desde el enlace del correo: /reset-password?token=…&email=…
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth card">
      <h1>Nueva contraseña</h1>
      @if (!token() || !email()) {
        <div class="alert alert-err">El enlace está incompleto. Pide uno nuevo desde <a routerLink="/login">Entrar</a>.</div>
      } @else {
        <p class="muted">Para {{ email() }}</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="password">Contraseña (mínimo 8 caracteres)</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" [class.invalid]="err('password')" />
            @if (err('password'); as e) { <div class="field-error">{{ e }}</div> }
          </div>
          <div class="field">
            <label for="password2">Repite la contraseña</label>
            <input id="password2" class="input" type="password" formControlName="password_confirmation" autocomplete="new-password" />
          </div>
          @if (err('token'); as e) { <div class="alert alert-err">{{ e }}</div> }
          <button class="btn btn-primary btn-block" [disabled]="busy()">Guardar contraseña</button>
        </form>
      }
    </div>
  `,
  styles: `.auth { max-width: 420px; margin: 2rem auto; }`,
})
export class ResetPassword {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  token = input<string>();
  email = input<string>();
  protected busy = signal(false);
  protected form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });

  err(name: string) { return fieldError(this.form, name); }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.api.resetPassword({ ...this.form.getRawValue(), token: this.token()!, email: this.email()! }).subscribe({
      next: () => { this.toast.ok('Contraseña guardada. Ya puedes entrar.'); this.router.navigate(['/login']); },
      error: (e) => { this.busy.set(false); applyFormErrors(this.form, e) || this.toast.error(errorMessage(e)); },
    });
  }
}
