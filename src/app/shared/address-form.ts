import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Address, AddressInput } from '../core/models';
import { ToastService, applyFormErrors, errorMessage, fieldError } from './ui';

export const STATES = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

// Crear o editar una dirección. Emite `saved` con la dirección guardada.
@Component({
  selector: 'app-address-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
      <div class="form-row">
        <div class="field">
          <label for="recipient">Quién recibe</label>
          <input id="recipient" class="input" formControlName="recipient" maxlength="120" autocomplete="name" [class.invalid]="err('recipient')" />
          @if (err('recipient'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="phone">Teléfono</label>
          <input id="phone" class="input" formControlName="phone" inputmode="tel" maxlength="30" autocomplete="tel" [class.invalid]="err('phone')" />
          @if (err('phone'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
      </div>
      <div class="field">
        <label for="line1">Dirección</label>
        <input id="line1" class="input" formControlName="line1" placeholder="Calle 10 # 20-30" maxlength="160" autocomplete="address-line1" [class.invalid]="err('line1')" />
        @if (err('line1'); as e) { <div class="field-error">{{ e }}</div> }
      </div>
      <div class="field">
        <label for="line2">Apartamento, torre, referencia (opcional)</label>
        <input id="line2" class="input" formControlName="line2" maxlength="160" autocomplete="address-line2" />
      </div>
      <div class="form-row">
        <div class="field">
          <label for="city">Ciudad</label>
          <input id="city" class="input" formControlName="city" maxlength="80" autocomplete="address-level2" [class.invalid]="err('city')" />
          @if (err('city'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
        <div class="field">
          <label for="state">Departamento</label>
          <select id="state" formControlName="state" [class.invalid]="err('state')">
            <option value="" disabled>Elige…</option>
            @for (s of states; track s) { <option [value]="s">{{ s }}</option> }
          </select>
          @if (err('state'); as e) { <div class="field-error">{{ e }}</div> }
        </div>
      </div>
      <div class="row">
        <button class="btn btn-solid" [disabled]="busy()">{{ address() ? 'Guardar cambios' : 'Guardar dirección' }}</button>
        @if (cancellable()) { <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">Cancelar</button> }
      </div>
    </form>
  `,
})
export class AddressForm {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  address = input<Address | null>(null);
  cancellable = input(false);
  saved = output<Address>();
  cancelled = output<void>();

  protected states = STATES;
  protected busy = signal(false);
  protected form = this.fb.nonNullable.group({
    recipient: ['', Validators.required],
    phone: ['', Validators.required],
    line1: ['', Validators.required],
    line2: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
  });

  ngOnInit() {
    const a = this.address();
    if (a) this.form.patchValue({ ...a, line2: a.line2 ?? '' });
  }

  err(name: string) { return fieldError(this.form, name); }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    const input: AddressInput = this.form.getRawValue();
    const req = this.address() ? this.api.updateAddress(this.address()!.id, input) : this.api.createAddress(input);
    req.subscribe({
      next: (a) => { this.busy.set(false); this.saved.emit(a); },
      error: (e) => { this.busy.set(false); applyFormErrors(this.form, e) || this.toast.error(errorMessage(e)); },
    });
  }
}
