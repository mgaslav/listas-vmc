import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App implements OnInit {
  protected readonly title = signal('Listas VMC');
  isAuthenticated = false;

  constructor(
    private supabaseService: SupabaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Check initial session status
    try {
      const { data } = await this.supabaseService.getSession();
      this.isAuthenticated = !!data.session;
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error fetching initial session:', e);
    }

    // Subscribe to auth state changes
    this.supabaseService.onAuthStateChange((event, session) => {
      this.isAuthenticated = !!session;
      this.cdr.detectChanges();
      if (!session) {
        this.router.navigate(['/login']);
      }
    });
  }

  async logout() {
    try {
      await this.supabaseService.logout();
      this.isAuthenticated = false;
      this.router.navigate(['/login']);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }
}
