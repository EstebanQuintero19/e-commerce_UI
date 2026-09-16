import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService, applyFormErrors, errorMessage, fieldError } from '../../shared/ui';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth card">
      <h1>Crear cuenta</h1>
      <p class="muted">¿Ya tienes una? <a routerLink="/login" [queryParams]="{ redirect: redirect() }">Entra</a></p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="name">Nombre</label>
          <input id="name" class="input" formControlName="name" autocomplete="name" [class.invalid]="err('name')" />
          @if (err('name'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="email">Correo</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" [class.invalid]="err('email')" />
          @if (err('email'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="password">Contraseña (mínimo 8 caracteres)</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" [class.invalid]="err('password')" />
          @if (err('password'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="password2">Repite la contraseña</label>
          <input id="password2" class="input" type="password" formControlName="password_confirmation" autocomplete="new-password" [class.invalid]="mismatch()" />
          @if (mismatch()) { <div class="field-error">Las contraseñas no coinciden</div> }
        </div>
        <button class="btn btn-primary btn-block" [disabled]="busy()">Crear cuenta</button>
      </form>
    </div>
  `,
  styles: `.auth { max-width: 420px; margin: 2rem auto; }`,
})
export class Register {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  redirect = input<string>();
  protected busy = signal(false);

  protected form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });

  err(name: string) { return fieldError(this.form, name); }
  mismatch() {
    const c = this.form.controls;
    return c.password_confirmation.touched && c.password_confirmation.value !== c.password.value;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.mismatch()) return;
    this.busy.set(true);
    const v = this.form.getRawValue();
    this.auth.register(v.name, v.email, v.password, v.password_confirmation).subscribe({
      next: () => { this.toast.ok('Cuenta creada'); this.router.navigateByUrl(this.redirect() || '/productos'); },
      error: (e) => { this.busy.set(false); applyFormErrors(this.form, e) || this.toast.error(errorMessage(e)); },
    });
  }
}
