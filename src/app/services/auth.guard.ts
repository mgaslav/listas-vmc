import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  try {
    const { data } = await supabaseService.getSession();
    if (data.session) {
      return true;
    }
  } catch (err) {
    console.error('Error checking session in authGuard:', err);
  }

  // Redirect to login page if no active session
  router.navigate(['/login']);
  return false;
};
