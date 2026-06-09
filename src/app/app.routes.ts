import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { PlanificadorComponent } from './components/planificador/planificador.component';
import { AdministracionParticipantesComponent } from './components/administracion-participantes/administracion-participantes.component';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'planificador', component: PlanificadorComponent, canActivate: [authGuard] },
  { path: 'participantes', component: AdministracionParticipantesComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'planificador', pathMatch: 'full' },
  { path: '**', redirectTo: 'planificador' }
];
