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

  getAsignacionesPorSeccion(semana: SemanaAsignaciones, seccion: 'introduccion' | 'tesoros' | 'maestros' | 'vida' | 'conclusion'): FilaAsignacion[] {
    return (semana.asignaciones || []).filter(a => {
      const s = a.seccion || this.getSeccionFallback(a.tipo_asignacion);
      return s === seccion;
    });
  }

  private getSeccionFallback(tipo: string): 'introduccion' | 'tesoros' | 'maestros' | 'vida' | 'conclusion' {
    if (['presidente', 'oracion_inicio'].includes(tipo)) return 'introduccion';
    if (['oracion_conclusion'].includes(tipo)) return 'conclusion';
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
      
      // For presidente, oracion_inicio, oracion_conclusion: use role-based rules as primary filter
      // since these aptitude fields may not be configured yet in the DB
      if (fila.filtro_aptitud === 'presidente') {
        if (c.genero !== 'Hombre') return false;
        if (c.rol !== 'Anciano' && c.rol !== 'Siervo Ministerial') return false;
        // If the aptitude field exists and is explicitly false, skip
        if (c.presidente === false) return false;
        return true;
      }
      
      if (fila.filtro_aptitud === 'oracion_inicio' || fila.filtro_aptitud === 'oracion_conclusion') {
        if (c.genero !== 'Hombre') return false;
        if (c.rol !== 'Anciano' && c.rol !== 'Siervo Ministerial' && c.rol !== 'Publicador') return false;
        // If the aptitude field exists and is explicitly false, skip
        const aptField = c[fila.filtro_aptitud as keyof CandidatoRotacion];
        if (aptField === false) return false;
        return true;
      }

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

      // Título del Documento
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(29, 29, 31); // Negro suave
      doc.text("Programa para la Reunión Vida y Ministerio Cristianos", 14, yPos);
      yPos += 12;

      // Generar una tabla por cada semana
      for (const semana of this.semanas) {
        const weekRows = [];
        
        // 1. Cabecera de la semana
        const lecturaText = semana.lectura_semanal ? `\nLECTURA SEMANAL DE LA BIBLIA: ${semana.lectura_semanal.toUpperCase()}` : '';
        const dateText = this.formatFechaSemana(semana.fecha_lunes).toUpperCase();
        const presidenteRow = semana.asignaciones.find(a => a.tipo_asignacion === 'presidente');
        const presidenteName = presidenteRow ? (this.getCandidatoInfo(presidenteRow.id_participante)?.nombre_completo || "Por asignar") : "Por asignar";
        
        weekRows.push([
          { content: `${dateText}${lecturaText}`, styles: { fontStyle: 'bold' as const, fontSize: 9, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
          { content: `Presidente: ${presidenteName}`, styles: { fontStyle: 'bold' as const, fontSize: 10, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], valign: 'middle' as const } }
        ]);
        
        // 2. Canción de inicio y oración
        const oracionInicioRow = semana.asignaciones.find(a => a.tipo_asignacion === 'oracion_inicio');
        const oracionInicioName = oracionInicioRow ? (this.getCandidatoInfo(oracionInicioRow.id_participante)?.nombre_completo || "Por asignar") : "Por asignar";
        const songInicioText = semana.cancion_inicio ? `• ${semana.cancion_inicio}` : '• Canción';
        weekRows.push([
          songInicioText,
          { content: `Oración:   ${oracionInicioName}`, styles: { fontStyle: 'normal' as const } }
        ]);
        
        // 3. Palabras de introducción
        weekRows.push([
          '• Palabras de introducción (1 min.)',
          presidenteName
        ]);
        
        // 4. Sección: Tesoros de la Biblia
        weekRows.push([
          { content: 'TESOROS DE LA BIBLIA', colSpan: 2, styles: { fillColor: [77, 77, 77] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9 } }
        ]);
        
        // Filtrar y agregar Tesoros
        const tesorosParts = semana.asignaciones.filter(a => a.seccion === 'tesoros' || (!a.seccion && this.getSeccionFallback(a.tipo_asignacion) === 'tesoros'));
        for (const fila of tesorosParts) {
          const titular = this.getCandidatoInfo(fila.id_participante)?.nombre_completo || "Por asignar";
          let cell2Text = titular;
          let cell2Styles: any = {};
          if (fila.tipo_asignacion === 'lectura_biblia') {
            const ayudante = fila.es_ayudante_obligatorio && fila.id_ayudante ? (this.getCandidatoInfo(fila.id_ayudante)?.nombre_completo || "Por asignar") : "Por asignar";
            cell2Text = `${titular} ------ ${ayudante}`;
            cell2Styles = { halign: 'left' };
          }
          weekRows.push([
            fila.etiqueta,
            { content: cell2Text, styles: cell2Styles }
          ]);
        }
        
        // 5. Sección: Seamos mejores maestros
        weekRows.push([
          { content: 'SEAMOS MEJORES MAESTROS', colSpan: 2, styles: { fillColor: [196, 141, 0] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9 } }
        ]);
        
        // Filtrar y agregar Maestros
        const maestrosParts = semana.asignaciones.filter(a => a.seccion === 'maestros' || (!a.seccion && this.getSeccionFallback(a.tipo_asignacion) === 'maestros'));
        for (const fila of maestrosParts) {
          const titular = this.getCandidatoInfo(fila.id_participante)?.nombre_completo || "Por asignar";
          let cell2Text = titular;
          if (fila.es_ayudante_obligatorio && fila.id_ayudante) {
            const ayudanteName = this.getCandidatoInfo(fila.id_ayudante)?.nombre_completo || "Por asignar";
            cell2Text = `${titular} ------ ${ayudanteName}`;
          }
          weekRows.push([
            fila.etiqueta,
            cell2Text
          ]);
        }
        
        // 6. Sección: Nuestra vida cristiana
        weekRows.push([
          { content: 'NUESTRA VIDA CRISTIANA', colSpan: 2, styles: { fillColor: [124, 15, 42] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9 } }
        ]);
        
        // Canción intermedia
        const songIntermediaText = semana.cancion_intermedia ? `• ${semana.cancion_intermedia}` : '• Canción';
        weekRows.push([
          songIntermediaText,
          ''
        ]);
        
        // Filtrar y agregar Vida
        const vidaParts = semana.asignaciones.filter(a => a.seccion === 'vida' || (!a.seccion && this.getSeccionFallback(a.tipo_asignacion) === 'vida'));
        for (const fila of vidaParts) {
          const titular = this.getCandidatoInfo(fila.id_participante)?.nombre_completo || "Por asignar";
          let cell2Text = titular;
          if (fila.tipo_asignacion === 'conductor_estudio') {
            const lector = fila.id_ayudante ? (this.getCandidatoInfo(fila.id_ayudante)?.nombre_completo || "Por asignar") : "Por asignar";
            cell2Text = `${titular} ------ ${lector}`;
          }
          weekRows.push([
            fila.etiqueta,
            cell2Text
          ]);
        }
        
        // 7. Palabras de conclusión
        weekRows.push([
          '• Palabras de conclusión (3 min.)',
          presidenteName
        ]);
        
        // 8. Canción de conclusión y oración
        const oracionConclusionRow = semana.asignaciones.find(a => a.tipo_asignacion === 'oracion_conclusion');
        const oracionConclusionName = oracionConclusionRow ? (this.getCandidatoInfo(oracionConclusionRow.id_participante)?.nombre_completo || "Por asignar") : "Por asignar";
        const songConclusionText = semana.cancion_conclusion ? `• ${semana.cancion_conclusion}` : '• Canción';
        weekRows.push([
          songConclusionText,
          { content: `Oración:   ${oracionConclusionName}`, styles: { fontStyle: 'normal' as const } }
        ]);

        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          body: weekRows,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2, font: "helvetica", textColor: [29, 29, 31] },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 90 }
          },
          margin: { top: 10, right: 10, bottom: 10, left: 10 }
        });

        // @ts-ignore
        yPos = (doc as any).lastAutoTable.finalY + 15;

        // Si la próxima semana no cabe, añadir página
        if (yPos > 240) {
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
