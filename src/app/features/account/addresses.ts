import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Address } from '../../core/models';
import { AddressForm } from '../../shared/address-form';
import { ToastService, applyFormErrors, errorMessage, fieldError } from '../../shared/ui';
import { PageMeta } from '../../shared/seo';

@Component({
  selector: 'app-addresses',
  imports: [ReactiveFormsModule, RouterLink, AddressForm],
  template: `
    <div class="page-head">
      <h1>Mi cuenta</h1>
      <div class="row"><a class="btn btn-ghost" routerLink="/facturas">Mis facturas</a><button type="button" class="btn btn-ghost" (click)="logout()">Cerrar sesión</button></div>
    </div>
    <div class="grid">
      <section class="card">
        <h2>Datos</h2>
        <form [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
          <div class="field"><label for="name">Nombre</label><input id="name" class="input" formControlName="name" [class.invalid]="err(profile, 'name')" />
            @if (err(profile, 'name'); as e) { <div class="field-error">{{ e }}</div> }</div>
          <div class="field"><label for="email">Correo</label><input id="email" class="input" type="email" formControlName="email" [class.invalid]="err(profile, 'email')" />
            @if (err(profile, 'email'); as e) { <div class="field-error">{{ e }}</div> }</div>
          <button class="btn btn-solid" [disabled]="busy()">Guardar datos</button>
        </form>
      </section>

      <section class="card">
        <h2>Contraseña</h2>
        <form [formGroup]="pwd" (ngSubmit)="savePassword()" novalidate>
          <div class="field"><label for="cur">Contraseña actual</label><input id="cur" class="input" type="password" formControlName="current_password" autocomplete="current-password" [class.invalid]="err(pwd, 'current_password')" />
            @if (err(pwd, 'current_password'); as e) { <div class="field-error">{{ e }}</div> }</div>
          <div class="field"><label for="new">Nueva (mínimo 8)</label><input id="new" class="input" type="password" formControlName="password" autocomplete="new-password" [class.invalid]="err(pwd, 'password')" />
            @if (err(pwd, 'password'); as e) { <div class="field-error">{{ e }}</div> }</div>
          <div class="field"><label for="new2">Repite la nueva</label><input id="new2" class="input" type="password" formControlName="password_confirmation" autocomplete="new-password" /></div>
          <button class="btn btn-solid" [disabled]="busy()">Cambiar contraseña</button>
          <p class="muted small" style="margin-top:0.75rem">Al cambiarla se cierran tus otras sesiones.</p>
        </form>
      </section>

      <section class="card wide">
        <div class="row between"><h2>Direcciones</h2>@if (editing() === undefined) { <button type="button" class="btn btn-sm" (click)="editing.set(null)">Agregar dirección</button> }</div>
        @if (editing() !== undefined) {
          <app-address-form [address]="editing() ?? null" [cancellable]="true" (saved)="onSaved($event)" (cancelled)="editing.set(undefined)" />
        }
        <div class="stack" style="margin-top:1rem">
          @for (a of addresses(); track a.id) {
            <div class="row between addr">
              <span><strong>{{ a.recipient }}</strong> · {{ a.phone }}<br />{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}, {{ a.city }}, {{ a.state }}</span>
              <span class="row"><button type="button" class="btn btn-ghost btn-sm" (click)="editing.set(a)">Editar</button><button type="button" class="btn btn-ghost btn-sm" (click)="remove(a)">Eliminar</button></span>
            </div>
          } @empty { <p class="muted">No tienes direcciones guardadas.</p> }
        </div>
      </section>
    </div>
  `,
  styles: `
    .grid { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
    @media (min-width: 800px) { .grid { grid-template-columns: 1fr 1fr; } .wide { grid-column: 1 / -1; } }
    .addr { padding: 0.75rem; border: 1px solid var(--line);  }
    .small { font-size: 0.8125rem; }
  `,
})
export class Addresses {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected busy = signal(false);
  protected addresses = signal<Address[]>([]);
  protected editing = signal<Address | null | undefined>(undefined); // undefined = cerrado, null = nueva

  protected profile = this.fb.nonNullable.group({
    name: [this.auth.user()?.name ?? '', Validators.required],
    email: [this.auth.user()?.email ?? '', [Validators.required, Validators.email]],
  });
  protected pwd = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });

  constructor() {
    inject(PageMeta).set('Mi cuenta');
    this.api.addresses().subscribe((l) => this.addresses.set(l));
  }

  err(form: typeof this.profile | typeof this.pwd, name: string) { return fieldError(form, name); }

  saveProfile() {
    this.profile.markAllAsTouched();
    if (this.profile.invalid) return;
    this.busy.set(true);
    this.api.updateProfile(this.profile.getRawValue()).subscribe({
      next: (u) => { this.busy.set(false); this.auth.user.set(u); this.toast.ok('Datos guardados'); },
      error: (e) => { this.busy.set(false); applyFormErrors(this.profile, e) || this.toast.error(errorMessage(e)); },
    });
  }

  savePassword() {
    this.pwd.markAllAsTouched();
    if (this.pwd.invalid) return;
    this.busy.set(true);
    const v = this.pwd.getRawValue();
    this.api.changePassword(v.current_password, v.password, v.password_confirmation).subscribe({
      next: () => { this.busy.set(false); this.pwd.reset(); this.toast.ok('Contraseña cambiada'); },
      error: (e) => { this.busy.set(false); applyFormErrors(this.pwd, e) || this.toast.error(errorMessage(e)); },
    });
  }

  onSaved(a: Address) {
    this.addresses.update((l) => (l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [a, ...l]));
    this.editing.set(undefined);
    this.toast.ok('Dirección guardada');
  }

  remove(a: Address) {
    if (!confirm(`¿Eliminar la dirección de ${a.recipient}?`)) return;
    this.api.deleteAddress(a.id).subscribe({
      next: () => this.addresses.update((l) => l.filter((x) => x.id !== a.id)),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/productos']));
  }
}
