import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  Participante,
  AptitudesParticipante,
  HistorialAsignacion,
  CandidatoRotacion
} from '../models/supabase.models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    let url = environment.supabaseUrl;
    // Sanitizar la URL si fue pegada con el sufijo de la REST API
    if (url.endsWith('/rest/v1/')) {
      url = url.slice(0, -9);
    } else if (url.endsWith('/rest/v1')) {
      url = url.slice(0, -8);
    }
    this.supabase = createClient(url, environment.supabaseKey);
  }

  /**
   * Supabase Authentication Methods
   */
  async login(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async logout() {
    return await this.supabase.auth.signOut();
  }

  async getSession() {
    return await this.supabase.auth.getSession();
  }

  onAuthStateChange(callback: (event: any, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Obtiene todos los participantes activos con sus correspondientes aptitudes
   */
  async getParticipantesConAptitudes(): Promise<{ participante: Participante; aptitudes: AptitudesParticipante }[]> {
    const { data, error } = await this.supabase
      .from('participantes')
      .select('*, aptitudes_participante(*)');

    if (error) {
      console.error('Error fetching participantes:', error);
      throw error;
    }

    return (data || []).map((row: any) => {
      // Map database row into a structured object
      const { aptitudes_participante, ...participanteData } = row;
      
      // Handle cases where 1:1 relation might not have a record yet (can be object, array, or null)
      let aptitudes: AptitudesParticipante;
      if (aptitudes_participante) {
        aptitudes = Array.isArray(aptitudes_participante)
          ? aptitudes_participante[0]
          : aptitudes_participante;
      } else {
        aptitudes = {
          id_participante: row.id,
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
          ayudante: false
        };
      }

      return {
        participante: participanteData as Participante,
        aptitudes
      };
    });
  }

  /**
   * Crea un nuevo participante y sus aptitudes asociadas
   */
  async crearParticipante(
    participante: Omit<Participante, 'id'>,
    aptitudes: Omit<AptitudesParticipante, 'id_participante'>
  ): Promise<Participante> {
    // 1. Insertar en participantes
    const { data: partData, error: partError } = await this.supabase
      .from('participantes')
      .insert([participante])
      .select()
      .single();

    if (partError) {
      console.error('Error al insertar participante:', partError);
      throw partError;
    }

    const nuevoId = partData.id;

    // 2. Insertar en aptitudes_participante
    const { error: aptError } = await this.supabase
      .from('aptitudes_participante')
      .insert([{
        id_participante: nuevoId,
        ...aptitudes
      }]);

    if (aptError) {
      console.error('Error al insertar aptitudes:', aptError);
      // Intentar revertir la creación del participante en caso de fallo parcial
      await this.supabase.from('participantes').delete().eq('id', nuevoId);
      throw aptError;
    }

    return partData as Participante;
  }

  /**
   * Actualiza los datos y aptitudes de un participante
   */
  async actualizarParticipante(
    id: string,
    participante: Partial<Participante>,
    aptitudes: Partial<AptitudesParticipante>
  ): Promise<void> {
    // 1. Actualizar participantes si hay campos
    if (Object.keys(participante).length > 0) {
      const { error: partError } = await this.supabase
        .from('participantes')
        .update(participante)
        .eq('id', id);

      if (partError) {
        console.error('Error al actualizar participante:', partError);
        throw partError;
      }
    }

    // 2. Actualizar/Insertar (Upsert) aptitudes para asegurar persistencia
    if (Object.keys(aptitudes).length > 0) {
      const { error: aptError } = await this.supabase
        .from('aptitudes_participante')
        .upsert({
          id_participante: id,
          ...aptitudes
        });
 
      if (aptError) {
        console.error('Error al actualizar/insertar aptitudes:', aptError);
        throw aptError;
      }
    }
  }

  /**
   * Realiza un borrado lógico desactivando al participante
   */
  async desactivarParticipante(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('participantes')
      .update({ activo: false })
      .eq('id', id);

    if (error) {
      console.error('Error al desactivar participante:', error);
      throw error;
    }
  }

  /**
   * Elimina de forma física al participante y sus registros asociados (si la cascada SQL está habilitada)
   */
  async eliminarParticipante(id: string): Promise<void> {
    // Primero eliminamos aptitudes de forma explícita por si no hay DELETE CASCADE
    await this.supabase
      .from('aptitudes_participante')
      .delete()
      .eq('id_participante', id);

    const { error } = await this.supabase
      .from('participantes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar participante:', error);
      throw error;
    }
  }

  /**
   * Obtiene los candidatos ordenados ascendentemente según su rotación (última participación)
   */
  async getCandidatosRotacion(): Promise<CandidatoRotacion[]> {
    const { data, error } = await this.supabase
      .from('v_candidatos_rotacion')
      .select('*');

    if (error) {
      console.error('Error al obtener candidatos de rotación:', error);
      throw error;
    }

    return (data || []) as CandidatoRotacion[];
  }

  /**
   * Registra masivamente un grupo de asignaciones confirmadas en el historial
   */
  async guardarHistorialAsignaciones(asignaciones: Omit<HistorialAsignacion, 'id'>[]): Promise<void> {
    if (asignaciones.length === 0) return;

    const { error } = await this.supabase
      .from('historial_asignaciones')
      .insert(asignaciones);

    if (error) {
      console.error('Error al guardar historial de asignaciones:', error);
      throw error;
    }
  }
}
