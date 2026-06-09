import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CargaPdfComponent } from '../carga-pdf/carga-pdf.component';
import { PrevisualizacionSemanalComponent } from '../previsualizacion-semanal/previsualizacion-semanal.component';
import { SupabaseService } from '../../services/supabase.service';
import { CandidatoRotacion, SemanaAsignaciones, HistorialAsignacion } from '../../models/supabase.models';

@Component({
  selector: 'app-planificador',
  standalone: true,
  imports: [CommonModule, CargaPdfComponent, PrevisualizacionSemanalComponent],
  templateUrl: './planificador.component.html',
  styleUrls: ['./planificador.component.css']
})
export class PlanificadorComponent implements OnInit {
  protected readonly title = signal('Planificador VMC');
  
  step: 'upload' | 'processing' | 'preview' | 'success' | 'error' = 'upload';
  candidatos: CandidatoRotacion[] = [];
  semanas: SemanaAsignaciones[] = [];
  selectedFile: File | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    try {
      this.candidatos = await this.supabaseService.getCandidatosRotacion();
      if (this.candidatos.length === 0) {
        this.generateMockCandidatos();
      }
    } catch (err: any) {
      console.error('Error al inicializar candidatos:', err);
      this.generateMockCandidatos();
    } finally {
      this.cdr.detectChanges();
    }
  }

  onFileSelected(file: File) {
    this.selectedFile = file;
  }

  async onStartProcessing() {
    if (!this.selectedFile) return;

    try {
      this.candidatos = await this.supabaseService.getCandidatosRotacion();
    } catch (e) {
      console.error('Error al recargar candidatos:', e);
    }

    if (this.candidatos.filter(c => c.activo).length < 2) {
      this.errorMessage = 'Aviso: Tienes muy pocos participantes activos configurados (menos de 2). Por favor, registra más participantes en la pestaña "Participantes" para que el sistema pueda sugerir asignaciones correctamente.';
      return;
    }

    this.step = 'processing';
    this.errorMessage = null;
    this.cdr.detectChanges();

    try {
      const base64 = await this.fileToBase64(this.selectedFile);

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pdfBase64: base64 })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Error del servidor: ${response.status}`);
      }

      const rawJson = await response.json();
      this.semanas = this.mapearRespuestaGemini(rawJson);
      this.step = 'preview';
    } catch (err: any) {
      console.error('Error al procesar PDF:', err);
      let errorMsg = err.message || 'Ocurrió un error al procesar el PDF del programa. Por favor intenta de nuevo.';
      
      if (errorMsg.includes('Unexpected token') || errorMsg.includes('is not valid JSON') || errorMsg.includes('<!DOCTYPE') || errorMsg.includes('Cannot POST')) {
        errorMsg = 'Error de conexión con el servidor. Asegúrate de ejecutar el proyecto con "npx vercel dev" en lugar de "ng serve" para que el procesamiento funcione correctamente.';
      } else if (errorMsg.includes('429') || errorMsg.includes('OpenAI') && errorMsg.includes('Límite')) {
        errorMsg = 'Tu cuenta de OpenAI ha alcanzado el límite de rate limit o no tiene saldo suficiente. Por favor, verifica tu facturación en platform.openai.com.';
      } else if (errorMsg.includes('OPENAI_API_KEY') || errorMsg.includes('API Key de OpenAI no está configurada')) {
        errorMsg = 'No has configurado la OPENAI_API_KEY en tu archivo .env. Asegúrate de que el archivo .env tenga tu clave de OpenAI y reinicia el servidor.';
      }

      this.errorMessage = errorMsg;
      this.step = 'upload';
    } finally {
      this.cdr.detectChanges();
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  private mapearRespuestaGemini(respuesta: any): SemanaAsignaciones[] {
    const semanasGemini = respuesta.semanas || [];
    return semanasGemini.map((sem: any) => {
      return {
        fecha_lunes: sem.fecha_lunes,
        asignaciones: (sem.partes || []).map((part: any) => {
          const isBrotherOnly = [
            'discurso_tesoros',
            'buscar_perlas',
            'lectura_biblia',
            'discurso_estudiantil',
            'vida_cristiana',
            'conductor_estudio',
            'lector_estudio'
          ].includes(part.tipo_asignacion);

          return {
            tipo_asignacion: part.tipo_asignacion,
            etiqueta: part.etiqueta,
            id_participante: '',
            es_ayudante_obligatorio: part.es_ayudante,
            filtro_aptitud: part.tipo_asignacion,
            genero_requerido: isBrotherOnly ? 'Hombre' : undefined,
            seccion: part.seccion
          };
        })
      };
    });
  }

  async onSaveProgram(asignaciones: Omit<HistorialAsignacion, 'id'>[]) {
    this.step = 'processing';
    this.cdr.detectChanges();
    try {
      await this.supabaseService.guardarHistorialAsignaciones(asignaciones);
      this.successMessage = `¡Programa guardado con éxito! Se registraron ${asignaciones.length} asignaciones en la base de datos de Supabase.`;
      this.step = 'success';
    } catch (err: any) {
      console.error('Error al guardar programa:', err);
      this.errorMessage = 'No se pudieron registrar las asignaciones en Supabase. Verifica la conexión.';
      this.step = 'error';
    } finally {
      this.cdr.detectChanges();
    }
  }

  resetFlow() {
    this.step = 'upload';
    this.selectedFile = null;
    this.semanas = [];
    this.errorMessage = null;
    this.successMessage = null;
  }

  private generateMockCandidatos() {
    this.candidatos = [
      {
        id_participante: '11111111-1111-1111-1111-111111111111',
        nombre_completo: 'Marcos Delgado',
        grupo_edad: 'Mayor',
        genero: 'Hombre',
        rol: 'Anciano',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: true,
        buscar_perlas: true,
        lectura_biblia: true,
        empiece_conversaciones: true,
        haga_revisitas: true, haga_discipulos: false, que_diria: false,
        explique_creencias: true,
        discurso_estudiantil: true,
        vida_cristiana: true,
        conductor_estudio: true,
        lector_estudio: true,
        ayudante: true,
        ultima_participacion: '2026-05-18'
      },
      {
        id_participante: '22222222-2222-2222-2222-222222222222',
        nombre_completo: 'Mateo Rodríguez',
        grupo_edad: 'Mayor',
        genero: 'Hombre',
        rol: 'Siervo Ministerial',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: true,
        buscar_perlas: true,
        lectura_biblia: true,
        empiece_conversaciones: true,
        haga_revisitas: true, haga_discipulos: false, que_diria: false,
        explique_creencias: true,
        discurso_estudiantil: true,
        vida_cristiana: true,
        conductor_estudio: false,
        lector_estudio: true,
        ayudante: true,
        ultima_participacion: '2026-05-25'
      },
      {
        id_participante: '33333333-3333-3333-3333-333333333333',
        nombre_completo: 'Lucía Santos',
        grupo_edad: 'Mayor',
        genero: 'Mujer',
        rol: 'Publicador',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: false,
        buscar_perlas: false,
        lectura_biblia: false,
        empiece_conversaciones: true,
        haga_revisitas: true, haga_discipulos: false, que_diria: false,
        explique_creencias: true,
        discurso_estudiantil: false,
        vida_cristiana: false,
        conductor_estudio: false,
        lector_estudio: false,
        ayudante: true,
        ultima_participacion: '2026-05-11'
      },
      {
        id_participante: '44444444-4444-4444-4444-444444444444',
        nombre_completo: 'Esteban Ortiz',
        grupo_edad: 'Menor',
        genero: 'Hombre',
        rol: 'Publicador',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: false,
        buscar_perlas: false,
        lectura_biblia: true,
        empiece_conversaciones: true,
        haga_revisitas: true, haga_discipulos: false, que_diria: false,
        explique_creencias: true,
        discurso_estudiantil: true,
        vida_cristiana: false,
        conductor_estudio: false,
        lector_estudio: true,
        ayudante: true,
        ultima_participacion: '2026-06-01'
      },
      {
        id_participante: '55555555-5555-5555-5555-555555555555',
        nombre_completo: 'Sofía Méndez',
        grupo_edad: 'Mayor',
        genero: 'Mujer',
        rol: 'Publicador No Bautizado',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: false,
        buscar_perlas: false,
        lectura_biblia: false,
        empiece_conversaciones: true,
        haga_revisitas: false, haga_discipulos: false, que_diria: false,
        explique_creencias: false,
        discurso_estudiantil: false,
        vida_cristiana: false,
        conductor_estudio: false,
        lector_estudio: false,
        ayudante: true,
        ultima_participacion: '2026-05-04'
      },
      {
        id_participante: '66666666-6666-6666-6666-666666666666',
        nombre_completo: 'David Muñoz',
        grupo_edad: 'Mayor',
        genero: 'Hombre',
        rol: 'Anciano',
        condicion_especial: false,
        activo: true,
        discurso_tesoros: true,
        buscar_perlas: true,
        lectura_biblia: true,
        empiece_conversaciones: true,
        haga_revisitas: true, haga_discipulos: false, que_diria: false,
        explique_creencias: true,
        discurso_estudiantil: true,
        vida_cristiana: true,
        conductor_estudio: true,
        lector_estudio: false,
        ayudante: true,
        ultima_participacion: null
      }
    ];
  }
}
