import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import {
  Participante,
  AptitudesParticipante,
  GrupoEdad,
  Genero,
  RolParticipante
} from '../../models/supabase.models';

@Component({
  selector: 'app-administracion-participantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administracion-participantes.component.html',
  styleUrls: ['./administracion-participantes.component.css']
})
export class AdministracionParticipantesComponent implements OnInit {
  participantesConAptitudes: { participante: Participante; aptitudes: AptitudesParticipante }[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  showFormModal = false;
  isEditing = false;
  selectedId: string | null = null;

  // Filtros de búsqueda
  searchTerm: string = '';
  filtroGrupoEdad: string = '';
  filtroGenero: string = '';
  filtroPrivilegio: string = '';
  filtroAsignacion: string = '';

  // Custom styled delete confirmation modal states
  showDeleteConfirmModal = false;
  idToDelete: string | null = null;
  nameToDelete: string | null = null;

  // Form Models
  formParticipante: Omit<Participante, 'id'> = {
    nombre_completo: '',
    grupo_edad: '' as any,
    genero: '' as any,
    rol: '' as any,
    condicion_especial: false,
    observaciones: '',
    activo: true
  };

  formAptitudes: Omit<AptitudesParticipante, 'id_participante'> = {
    discurso_tesoros: false,
    buscar_perlas: false,
    lectura_biblia: false,
    empiece_conversaciones: false,
    haga_revisitas: false,
    haga_discipulos: false,
    explique_creencias: false,
    que_diria: false,
    discurso_estudiantil: false,
    vida_cristiana: false,
    conductor_estudio: false,
    lector_estudio: false,
    ayudante: false,
    presidente: false,
    oracion_inicio: false,
    oracion_conclusion: false
  };

  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarParticipantes();
  }

  async cargarParticipantes(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      this.participantesConAptitudes = await this.supabaseService.getParticipantesConAptitudes();
    } catch (err: any) {
      console.error('Error al cargar participantes:', err);
      this.errorMessage = 'No se pudieron cargar los participantes. Verifica la conexión a la base de datos.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get participantesFiltrados() {
    return this.participantesConAptitudes.filter(item => {
      // Búsqueda por nombre
      if (this.searchTerm && !item.participante.nombre_completo.toLowerCase().includes(this.searchTerm.toLowerCase())) {
        return false;
      }
      // Filtro Edad
      if (this.filtroGrupoEdad && item.participante.grupo_edad !== this.filtroGrupoEdad) {
        return false;
      }
      // Filtro Género
      if (this.filtroGenero && item.participante.genero !== this.filtroGenero) {
        return false;
      }
      // Filtro Privilegio (Rol)
      if (this.filtroPrivilegio && item.participante.rol !== this.filtroPrivilegio) {
        return false;
      }
      // Filtro Asignación
      if (this.filtroAsignacion) {
        const hasAsignacion = item.aptitudes[this.filtroAsignacion as keyof AptitudesParticipante] === true;
        if (!hasAsignacion) return false;
      }
      return true;
    });
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.filtroGrupoEdad = '';
    this.filtroGenero = '';
    this.filtroPrivilegio = '';
    this.filtroAsignacion = '';
  }

  abrirCrearModal(): void {
    this.isEditing = false;
    this.selectedId = null;
    this.formParticipante = {
      nombre_completo: '',
      grupo_edad: '' as any,
      genero: '' as any,
      rol: '' as any,
      condicion_especial: false,
      observaciones: '',
      activo: true
    };
    this.formAptitudes = {
      discurso_tesoros: false,
      buscar_perlas: false,
      lectura_biblia: false,
      empiece_conversaciones: false,
      haga_revisitas: false,
      haga_discipulos: false,
      explique_creencias: false,
      que_diria: false,
      discurso_estudiantil: false,
      vida_cristiana: false,
      conductor_estudio: false,
      lector_estudio: false,
      ayudante: false,
      presidente: false,
      oracion_inicio: false,
      oracion_conclusion: false
    };
    this.showFormModal = true;
  }

  abrirEditarModal(item: { participante: Participante; aptitudes: AptitudesParticipante }): void {
    this.isEditing = true;
    this.selectedId = item.participante.id;
    
    this.formParticipante = {
      nombre_completo: item.participante.nombre_completo,
      grupo_edad: item.participante.grupo_edad,
      genero: item.participante.genero,
      rol: item.participante.rol,
      condicion_especial: item.participante.condicion_especial,
      observaciones: item.participante.observaciones || '',
      activo: item.participante.activo
    };

    this.formAptitudes = {
      discurso_tesoros: item.aptitudes.discurso_tesoros,
      buscar_perlas: item.aptitudes.buscar_perlas,
      lectura_biblia: item.aptitudes.lectura_biblia,
      empiece_conversaciones: item.aptitudes.empiece_conversaciones,
      haga_revisitas: item.aptitudes.haga_revisitas,
      haga_discipulos: item.aptitudes.haga_discipulos,
      explique_creencias: item.aptitudes.explique_creencias,
      que_diria: item.aptitudes.que_diria,
      discurso_estudiantil: item.aptitudes.discurso_estudiantil,
      vida_cristiana: item.aptitudes.vida_cristiana,
      conductor_estudio: item.aptitudes.conductor_estudio,
      lector_estudio: item.aptitudes.lector_estudio,
      ayudante: item.aptitudes.ayudante || false,
      presidente: item.aptitudes.presidente || false,
      oracion_inicio: item.aptitudes.oracion_inicio || false,
      oracion_conclusion: item.aptitudes.oracion_conclusion || false
    };

    this.showFormModal = true;
  }

  cerrarModal(): void {
    this.showFormModal = false;
  }

  onGeneroChange(): void {
    this.onDropdownChange();
  }

  onGrupoEdadChange(): void {
    this.onDropdownChange();
  }

  onDropdownChange(): void {
    this.aplicarPredeterminados();
  }

  isFormValid(): boolean {
    return !!this.formParticipante.nombre_completo?.trim() &&
           !!this.formParticipante.grupo_edad &&
           !!this.formParticipante.genero &&
           !!this.formParticipante.rol;
  }

  isAptitudAvailable(aptitud: keyof AptitudesParticipante): boolean {
    if (!this.isFormValid()) return false;

    const g = this.formParticipante.genero;
    const e = this.formParticipante.grupo_edad;
    const r = this.formParticipante.rol;
    const c = this.formParticipante.condicion_especial;

    // Quien tenga activada la casilla “Condición especial” solo debe de tener disponible y activado “Ayudante”
    if (c) {
      return aptitud === 'ayudante';
    }

    if (aptitud === 'presidente') {
      return g === 'Hombre' && (r === 'Anciano' || r === 'Siervo Ministerial');
    }

    if (aptitud === 'oracion_inicio' || aptitud === 'oracion_conclusion') {
      return g === 'Hombre' && (r === 'Anciano' || r === 'Siervo Ministerial' || r === 'Publicador');
    }

    // “Menor de edad” solo debe de tener disponible y marcado las asignaciones de Seamos mejores maestros, a excepción de “¿Qué diría?”
    if (e === 'Menor') {
      const isMaestros = ['empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'discurso_estudiantil', 'ayudante'].includes(aptitud);
      if (!isMaestros || aptitud === 'que_diria') return false;
    }

    // Género - “Mujer”: solo debe de tener disponible y marcado las asignaciones de Seamos mejores maestros menos “¿Qué diría?” y “Discurso (Maestros)”
    if (g === 'Mujer') {
      const isMaestros = ['empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'ayudante'].includes(aptitud);
      if (!isMaestros) return false;
    }

    // Privilegios:
    // “Anciano”: todas las asignaciones (no filtra nada adicional)
    if (r === 'Siervo Ministerial') {
      // “Siervo ministerial”: todas las asignaciones de las secciones Tesoros de la Biblia y de Seamos mejores maestros.
      const isTesorosOrMaestros = [
        'discurso_tesoros', 'buscar_perlas', 'lectura_biblia',
        'empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'que_diria', 'discurso_estudiantil', 'ayudante'
      ].includes(aptitud);
      if (!isTesorosOrMaestros) return false;
    } else if (r === 'Publicador') {
      // “Publicador”: Solo todas las asignaciones de la sección Seamos mejores maestros. La asignación de “Lectura de la Biblia” en Tesoros y “Lector de Estudio” en Vida.
      const allowed = [
        'empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'que_diria', 'discurso_estudiantil', 'ayudante',
        'lectura_biblia', 'lector_estudio'
      ];
      if (!allowed.includes(aptitud)) return false;
    } else if (r === 'Publicador No Bautizado') {
      // “Publicador no bautizado”: Todas las asignaciones de seamos mejores maestros, menos “¿Qué diría?”, más “Lectura de la Biblia” de la sección Tesoros de la Biblia.
      const isMaestros = ['empiece_conversaciones', 'haga_revisitas', 'haga_discipulos', 'explique_creencias', 'discurso_estudiantil', 'ayudante'].includes(aptitud);
      const isBibliaReading = aptitud === 'lectura_biblia';
      if ((!isMaestros && !isBibliaReading) || aptitud === 'que_diria') return false;
    }

    return true;
  }

  aplicarPredeterminados(): void {
    if (!this.isFormValid()) {
      // Si no es válido el formulario, desmarcar todo
      for (const key of Object.keys(this.formAptitudes) as (keyof Omit<AptitudesParticipante, 'id_participante'>)[]) {
        this.formAptitudes[key] = false;
      }
      return;
    }

    // Activar por defecto todas las asignaciones disponibles/permitidas
    for (const key of Object.keys(this.formAptitudes) as (keyof Omit<AptitudesParticipante, 'id_participante'>)[]) {
      this.formAptitudes[key] = this.isAptitudAvailable(key);
    }
  }

  verificarAptitudesExclusivas(): void {
    // Limpieza final antes de guardar, asegura consistencia total
    for (const key of Object.keys(this.formAptitudes) as (keyof Omit<AptitudesParticipante, 'id_participante'>)[]) {
      if (!this.isAptitudAvailable(key)) {
        this.formAptitudes[key] = false;
      }
    }
  }

  async guardar(): Promise<void> {
    if (!this.isFormValid()) {
      alert('Por favor complete todos los campos obligatorios: Nombre completo, Grupo de edad, Género y Privilegio.');
      return;
    }

    // Limpiar aptitudes exclusivas
    this.verificarAptitudesExclusivas();

    this.isLoading = true;
    this.errorMessage = null;
    try {
      if (this.isEditing && this.selectedId) {
        // Actualizar
        await this.supabaseService.actualizarParticipante(
          this.selectedId,
          this.formParticipante,
          this.formAptitudes
        );
      } else {
        // Crear nuevo
        await this.supabaseService.crearParticipante(
          this.formParticipante,
          this.formAptitudes
        );
      }
      this.showFormModal = false;
      await this.cargarParticipantes();
    } catch (err: any) {
      console.error('Error al guardar participante:', err);
      this.errorMessage = 'Ocurrió un error al intentar guardar el registro. Verifica los datos.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async toggleActivo(item: { participante: Participante; aptitudes: AptitudesParticipante }): Promise<void> {
    const nuevoEstado = !item.participante.activo;
    try {
      await this.supabaseService.actualizarParticipante(
        item.participante.id,
        { activo: nuevoEstado },
        {}
      );
      // Forzar la recarga desde la base de datos para sincronizar el estado reactivo inmediatamente
      await this.cargarParticipantes();
    } catch (err: any) {
      console.error('Error al cambiar estado activo:', err);
      alert('No se pudo actualizar el estado del participante.');
    }
  }

  // custom styled delete modal triggers
  solicitarEliminacion(id: string, nombreCompleto: string): void {
    this.idToDelete = id;
    this.nameToDelete = nombreCompleto;
    this.showDeleteConfirmModal = true;
  }

  cancelarEliminacion(): void {
    this.showDeleteConfirmModal = false;
    this.idToDelete = null;
    this.nameToDelete = null;
  }

  async confirmarEliminacion(): Promise<void> {
    if (!this.idToDelete) return;
    this.isLoading = true;
    this.showDeleteConfirmModal = false;
    this.errorMessage = null;
    try {
      await this.supabaseService.eliminarParticipante(this.idToDelete);
      await this.cargarParticipantes();
    } catch (err: any) {
      console.error('Error al eliminar participante:', err);
      this.errorMessage = 'No se pudo eliminar al participante. Es posible que tenga registros históricos asociados en historial_asignaciones.';
    } finally {
      this.isLoading = false;
      this.idToDelete = null;
      this.nameToDelete = null;
      this.cdr.detectChanges();
    }
  }
}
