import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const { email, password } = this.loginForm.value;

    try {
      const { data, error } = await this.supabaseService.login(email, password);
      if (error) {
        throw error;
      }
      if (data.session) {
        this.router.navigate(['/planificador']);
      } else {
        this.errorMessage = 'No se pudo obtener la sesión. Intente de nuevo.';
      }
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
      this.errorMessage = err.message || 'Credenciales inválidas. Verifica tu correo y contraseña.';
    } finally {
      this.isLoading = false;
    }
  }
}
