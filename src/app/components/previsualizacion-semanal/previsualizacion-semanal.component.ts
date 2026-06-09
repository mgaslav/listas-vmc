import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CandidatoRotacion,
  SemanaAsignaciones,
  FilaAsignacion,
  HistorialAsignacion,
  AptitudesParticipante
} from '../../models/supabase.models';

@Component({
  selector: 'app-previsualizacion-semanal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './previsualizacion-semanal.component.html',
  styleUrls: ['./previsualizacion-semanal.component.css']
})
export class PrevisualizacionSemanalComponent implements OnInit {
  @Input() semanas: SemanaAsignaciones[] = [];
  @Input() candidatos: CandidatoRotacion[] = [];
  
  @Output() saveProgram = new EventEmitter<Omit<HistorialAsignacion, 'id'>[]>();
  @Output() cancel = new EventEmitter<void>();

  get totalCandidatosActivos(): number {
    return this.candidatos.filter(c => c.activo).length;
  }

  private asignacionesConteo = new Map<string, number>();

  ngOnInit(): void {
    // Ensure all assignments are populated with valid defaults from candidates if empty
    this.autoAssignDefaults();
  }

  private registrarAsignacion(id: string): void {
    if (id) {
      const actual = this.asignacionesConteo.get(id) || 0;
      this.asignacionesConteo.set(id, actual + 1);
    }
  }

  /**
   * Auto-assigns the highest-priority (longest time since last assignment) candidates to fill empty slots
   */
  autoAssignDefaults(): void {
    this.asignacionesConteo.clear();

    for (const semana of this.semanas) {
      for (const fila of semana.asignaciones) {
        // Find best student if not assigned
        if (!fila.id_participante) {
          const matchingStudents = this.getCandidatosParaEstudiante(fila, true);
          if (matchingStudents.length > 0) {
            fila.id_participante = matchingStudents[0].id_participante;
            this.registrarAsignacion(fila.id_participante);
          }
        } else {
          this.registrarAsignacion(fila.id_participante);
        }
        
        // Find best assistant if needed and not assigned
        if (fila.es_ayudante_obligatorio && !fila.id_ayudante && fila.id_participante) {
          const matchingHelpers = this.getCandidatosParaAyudante(fila, fila.id_participante, true);
          if (matchingHelpers.length > 0) {
            fila.id_ayudante = matchingHelpers[0].id_participante;
            this.registrarAsignacion(fila.id_ayudante);
          }
        } else if (fila.es_ayudante_obligatorio && fila.id_ayudante) {
          this.registrarAsignacion(fila.id_ayudante);
        }
      }
    }
  }

  /**
   * Sorts an array of candidates so that those with the fewest assignments in the current session are first.
   */
  private sortCandidatesByConteo(candidates: CandidatoRotacion[]): CandidatoRotacion[] {
    return [...candidates].sort((a, b) => {
      const countA = this.asignacionesConteo.get(a.id_participante) || 0;
      const countB = this.asignacionesConteo.get(b.id_participante) || 0;
      return countA - countB;
    });
  }

  getAsignacionesPorSeccion(semana: SemanaAsignaciones, seccion: 'tesoros' | 'maestros' | 'vida'): FilaAsignacion[] {
    return (semana.asignaciones || []).filter(a => {
      const s = a.seccion || this.getSeccionFallback(a.tipo_asignacion);
      return s === seccion;
    });
  }

  private getSeccionFallback(tipo: string): 'tesoros' | 'maestros' | 'vida' {
    if (['discurso_tesoros', 'buscar_perlas', 'lectura_biblia'].includes(tipo)) return 'tesoros';
    if (['empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'que_diria', 'discurso_estudiantil'].includes(tipo)) return 'maestros';
    return 'vida';
  }

  /**
   * Filters the candidates view for the main role based on aptitudes and gender rules.
   * Excludes candidates who are marked as 'solo_ayudante'.
   */
  getCandidatosParaEstudiante(fila: FilaAsignacion, sortByLeastUsedThisSession: boolean = false): CandidatoRotacion[] {
    const allEligible = this.candidatos.filter(c => {
      if (!c.activo) return false;
      
      // Map the string key to the matching boolean on the candidate object
      const hasAptitude = c[fila.filtro_aptitud as keyof CandidatoRotacion] === true;
      if (!hasAptitude) return false;

      // Special rule: ¿Qué diría? solo asignado a varones adultos (GrupoEdad 'Mayor')
      if (fila.filtro_aptitud === 'que_diria') {
        if (c.genero !== 'Hombre' || c.grupo_edad !== 'Mayor') return false;
      } else if (fila.genero_requerido && c.genero !== fila.genero_requerido) {
        return false;
      }

      // Rule: "Necesidades de la congregación" / "Necesidades locales" always assigned to an Elder (Anciano)
      const labelLower = (fila.etiqueta || '').toLowerCase();
      if (labelLower.includes('necesidades de la congregación') || labelLower.includes('necesidades locales')) {
        if (c.rol !== 'Anciano') return false;
      }

      return true;
    });

    if (sortByLeastUsedThisSession) {
      return this.sortCandidatesByConteo(allEligible);
    }

    return allEligible;
  }

  /**
   * Filters the candidates view for the assistant role.
   * Ensures the assistant matches the gender of the assigned student.
   */
  getCandidatosParaAyudante(fila: FilaAsignacion, idEstudiante: string, sortByLeastUsedThisSession: boolean = false): CandidatoRotacion[] {
    if (!idEstudiante) return [];

    const estudiante = this.candidatos.find(c => c.id_participante === idEstudiante);
    const generoEstudiante = estudiante ? estudiante.genero : null;

    const allEligible = this.candidatos.filter(c => {
      if (!c.activo) return false;
      
      // Exclude the student themselves from being their own assistant
      if (c.id_participante === idEstudiante) return false;

      // Special rule: If the assignment is "conductor_estudio", the "ayudante" is actually the Lector
      if (fila.filtro_aptitud === 'conductor_estudio') {
        if (c.genero !== 'Hombre') return false; // Lector must be male
        if (!c.lector_estudio) return false; // Must be approved as lector
        return true;
      }

      // Standard helpers
      // In VMC, assistant gender MUST match student gender
      if (generoEstudiante && c.genero !== generoEstudiante) return false;
      
      // Must explicitly have the "ayudante" assignment permitted
      if (!c.ayudante) return false;

      return true;
    });

    if (sortByLeastUsedThisSession) {
      return this.sortCandidatesByConteo(allEligible);
    }

    return allEligible;
  }

  /**
   * Triggers when the student select changes, to re-verify assistant suitability and automatically
   * adapt assistant selections if their gender is mismatching.
   */
  onEstudianteChange(fila: FilaAsignacion): void {
    if (fila.es_ayudante_obligatorio && fila.id_participante) {
      const allowedHelpers = this.getCandidatosParaAyudante(fila, fila.id_participante);
      
      // If the current helper is not in the allowed helpers list (due to gender shift or self-selection)
      if (fila.id_ayudante && !allowedHelpers.some(h => h.id_participante === fila.id_ayudante)) {
        // Re-assign to the first eligible helper
        fila.id_ayudante = allowedHelpers.length > 0 ? allowedHelpers[0].id_participante : '';
      }
    }
  }

  /**
   * Transforms the local component model state into database-friendly HistorialAsignacion objects
   * and triggers the PDF generation.
   */
  confirmarProgramacion(): void {
    const finalAsignaciones: Omit<HistorialAsignacion, 'id'>[] = [];

    for (const semana of this.semanas) {
      for (const fila of semana.asignaciones) {
        if (fila.id_participante) {
          // Main assignment
          finalAsignaciones.push({
            id_participante: fila.id_participante,
            tipo_asignacion: fila.tipo_asignacion,
            fecha_reunion: semana.fecha_lunes,
            es_ayudante: false
          });

          // Helper assignment (if applicable and selected)
          if (fila.es_ayudante_obligatorio && fila.id_ayudante) {
            let tipoAsig = `${fila.tipo_asignacion}_ayudante`;
            if (fila.filtro_aptitud === 'conductor_estudio') {
              tipoAsig = 'lector_estudio';
            }
            finalAsignaciones.push({
              id_participante: fila.id_ayudante,
              tipo_asignacion: tipoAsig,
              fecha_reunion: semana.fecha_lunes,
              es_ayudante: true
            });
          }
        }
      }
    }

    this.generarPDF();
    this.saveProgram.emit(finalAsignaciones);
  }

  /**
   * Generates and downloads a beautifully formatted PDF with the assigned program
   */
  generarPDF(): void {
    try {
      const doc = new jsPDF();
      
      // Configuración general del documento
      doc.setFont("helvetica");
      let yPos = 20;

      // Título
      doc.setFontSize(18);
      doc.setTextColor(0, 113, 227); // Azul Apple
      doc.text("Programa Vida y Ministerio Cristianos", 14, yPos);
      yPos += 10;

      // Generar una tabla por cada semana
      for (const semana of this.semanas) {
        // Título de la semana
        doc.setFontSize(14);
        doc.setTextColor(29, 29, 31); // Negro suave
        doc.text(this.formatFechaSemana(semana.fecha_lunes), 14, yPos);
        yPos += 5;

        const bodyData = semana.asignaciones.map(fila => {
          const titular = this.getCandidatoInfo(fila.id_participante)?.nombre_completo || "Por asignar";
          
          let ayudanteStr = "";
          if (fila.es_ayudante_obligatorio && fila.id_ayudante) {
            const nombreAyudante = this.getCandidatoInfo(fila.id_ayudante)?.nombre_completo;
            if (fila.filtro_aptitud === 'conductor_estudio') {
              ayudanteStr = ` (Lector: ${nombreAyudante})`;
            } else {
              ayudanteStr = ` (Ayudante: ${nombreAyudante})`;
            }
          }
          
          return [fila.etiqueta, `${titular}${ayudanteStr}`];
        });

        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [['Asignación', 'Participante']],
          body: bodyData,
          theme: 'grid',
          headStyles: { fillColor: [0, 113, 227], textColor: 255 },
          styles: { fontSize: 10, cellPadding: 3 },
          margin: { top: 10, right: 14, bottom: 10, left: 14 },
        });

        // @ts-ignore
        yPos = (doc as any).lastAutoTable.finalY + 15;

        // Si la próxima semana no cabe, añadir página
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
      }

      // Guardar PDF de forma nativa utilizando el método de descarga nativo de jsPDF
      doc.save('Programa_VMC.pdf');
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Hubo un problema al generar el PDF. Asegúrate de tener la extensión correctamente cargada.");
    }
  }

  /**
   * Helper to fetch candidate details by UUID
   */
  getCandidatoInfo(id: string): CandidatoRotacion | undefined {
    return this.candidatos.find(c => c.id_participante === id);
  }

  /**
   * Format dates nicely (e.g. 2026-06-08 into "Semana del 8 de Jun, 2026")
   */
  formatFechaSemana(fechaStr: string): string {
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    const fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    return `Semana del ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
}
