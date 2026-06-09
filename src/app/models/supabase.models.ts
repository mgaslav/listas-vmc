export type GrupoEdad = 'Mayor' | 'Menor';
export type Genero = 'Hombre' | 'Mujer';
export type RolParticipante = 'Anciano' | 'Siervo Ministerial' | 'Publicador' | 'Publicador No Bautizado';

export interface Participante {
  id: string; // UUID
  nombre_completo: string;
  grupo_edad: GrupoEdad;
  genero: Genero;
  rol: RolParticipante;
  condicion_especial: boolean;
  observaciones: string | null;
  activo: boolean;
}

export interface AptitudesParticipante {
  id_participante: string; // UUID
  discurso_tesoros: boolean;
  buscar_perlas: boolean;
  lectura_biblia: boolean;
  empiece_conversaciones: boolean;
  haga_revisitas: boolean;
  haga_discipulos: boolean;
  explique_creencias: boolean;
  que_diria: boolean;
  discurso_estudiantil: boolean;
  vida_cristiana: boolean;
  conductor_estudio: boolean;
  lector_estudio: boolean;
  ayudante: boolean;
  presidente?: boolean;
  oracion_inicio?: boolean;
  oracion_conclusion?: boolean;
}

export interface HistorialAsignacion {
  id?: string | number; // UUID or ID auto-generated
  id_participante: string; // UUID
  tipo_asignacion: string;
  fecha_reunion: string; // YYYY-MM-DD
  es_ayudante: boolean;
}

export interface CandidatoRotacion {
  id_participante: string; // UUID
  nombre_completo: string;
  grupo_edad: GrupoEdad;
  genero: Genero;
  rol: RolParticipante;
  condicion_especial: boolean;
  activo: boolean;
  // Aptitudes columns flattened from the view join
  discurso_tesoros: boolean;
  buscar_perlas: boolean;
  lectura_biblia: boolean;
  empiece_conversaciones: boolean;
  haga_revisitas: boolean;
  haga_discipulos: boolean;
  explique_creencias: boolean;
  que_diria: boolean;
  discurso_estudiantil: boolean;
  vida_cristiana: boolean;
  conductor_estudio: boolean;
  lector_estudio: boolean;
  ayudante: boolean;
  presidente?: boolean;
  oracion_inicio?: boolean;
  oracion_conclusion?: boolean;
  // Rotation tracker
  ultima_participacion: string | null; // YYYY-MM-DD (nullable)
}

// Frontend representations for assignments editing flow
export interface AsignacionEdicion {
  id_participante: string; // UUID of assigned person
  nombre_completo: string; // Cache name for easy display
  es_ayudante: boolean;
  tipo_asignacion: string; // e.g., 'Lectura', 'Primera Conversación', 'Revisita', etc.
}

export interface FilaAsignacion {
  tipo_asignacion: string;
  etiqueta: string; // Label in Spanish, e.g., "Lectura de la Biblia"
  id_participante: string; // UUID
  id_ayudante?: string; // Optional UUID if assignment supports/needs assistant
  es_ayudante_obligatorio: boolean;
  filtro_aptitud: keyof AptitudesParticipante; // To filter potential candidates
  genero_requerido?: Genero; // Optional if gender restricted
  seccion?: 'introduccion' | 'tesoros' | 'maestros' | 'vida' | 'conclusion';
}

export interface SemanaAsignaciones {
  fecha_lunes: string; // YYYY-MM-DD (the week identifier)
  asignaciones: FilaAsignacion[];
  lectura_semanal?: string;
  cancion_inicio?: string;
  cancion_intermedia?: string;
  cancion_conclusion?: string;
}

export interface RespuestaGemini {
  semanas: {
    fecha_lunes: string; // YYYY-MM-DD
    lectura_semanal?: string;
    cancion_inicio?: string;
    cancion_intermedia?: string;
    cancion_conclusion?: string;
    partes: {
      tipo_asignacion: string; // e.g., 'lectura_biblia', 'primera_conversacion', etc.
      etiqueta: string;
      seccion: 'tesoros' | 'maestros' | 'vida';
      es_ayudante: boolean;
      sugerencia_nombre_completo?: string; // Gemini suggestion
    }[];
  }[];
}
