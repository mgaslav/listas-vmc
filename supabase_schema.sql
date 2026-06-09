-- ==========================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS: LISTAS VMC
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor)
-- ==========================================

-- 1. Habilitar la extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Limpieza de vistas y tablas previas para reconfiguración
DROP VIEW IF EXISTS v_candidatos_rotacion;
DROP TABLE IF EXISTS aptitudes_participante;
-- Opcional: drop historial si es necesario, pero lo mantenemos si es compatible.
-- DROP TABLE IF EXISTS historial_asignaciones;
-- DROP TABLE IF EXISTS participantes;

-- 3. Tabla de Participantes (se mantiene si existe, de lo contrario se crea)
CREATE TABLE IF NOT EXISTS participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    grupo_edad TEXT NOT NULL CHECK (grupo_edad IN ('Mayor', 'Menor')),
    genero TEXT NOT NULL CHECK (genero IN ('Hombre', 'Mujer')),
    rol TEXT NOT NULL CHECK (rol IN ('Anciano', 'Siervo Ministerial', 'Publicador', 'Publicador No Bautizado')),
    condicion_especial BOOLEAN DEFAULT FALSE,
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Aptitudes (Relación 1:1 con participantes - RECONFIGURADA CON LAS 10 APTITUDES)
CREATE TABLE aptitudes_participante (
    id_participante UUID PRIMARY KEY REFERENCES participantes(id) ON DELETE CASCADE,
    discurso_tesoros BOOLEAN DEFAULT FALSE,       -- 1. Discurso (Tesoros de la Biblia)
    buscar_perlas BOOLEAN DEFAULT FALSE,          -- 2. Busquemos perlas escondidas
    lectura_biblia BOOLEAN DEFAULT FALSE,         -- 3. Lectura de la Biblia
    empiece_conversaciones BOOLEAN DEFAULT FALSE,  -- 4. Empiece conversaciones
    haga_revisitas BOOLEAN DEFAULT FALSE,         -- 5. Haga revisitas
    explique_creencias BOOLEAN DEFAULT FALSE,     -- 6. Explique sus creencias
    discurso_estudiantil BOOLEAN DEFAULT FALSE,   -- 7. Discurso (estudiantil)
    vida_cristiana BOOLEAN DEFAULT FALSE,         -- 8. Nuestra vida cristiana (asignaciones)
    conductor_estudio BOOLEAN DEFAULT FALSE,      -- 9. Conductor de Estudio
    lector_estudio BOOLEAN DEFAULT FALSE          -- 10. Lector de Estudio
);

-- 5. Tabla de Historial de Asignaciones (se mantiene si existe)
CREATE TABLE IF NOT EXISTS historial_asignaciones (
    id BIGSERIAL PRIMARY KEY,
    id_participante UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
    tipo_asignacion TEXT NOT NULL,
    fecha_reunion DATE NOT NULL,
    es_ayudante BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Vista SQL para Candidatos de Rotación (v_candidatos_rotacion - ACTUALIZADA)
CREATE OR REPLACE VIEW v_candidatos_rotacion AS
SELECT 
    p.id AS id_participante,
    p.nombre_completo,
    p.grupo_edad,
    p.genero,
    p.rol,
    p.condicion_especial,
    p.activo,
    a.discurso_tesoros,
    a.buscar_perlas,
    a.lectura_biblia,
    a.empiece_conversaciones,
    a.haga_revisitas,
    a.explique_creencias,
    a.discurso_estudiantil,
    a.vida_cristiana,
    a.conductor_estudio,
    a.lector_estudio,
    MAX(h.fecha_reunion) AS ultima_participacion
FROM participantes p
LEFT JOIN aptitudes_participante a ON p.id = a.id_participante
LEFT JOIN historial_asignaciones h ON p.id = h.id_participante
WHERE p.activo = true
GROUP BY 
    p.id, 
    p.nombre_completo, 
    p.grupo_edad, 
    p.genero, 
    p.rol, 
    p.condicion_especial, 
    p.activo,
    a.discurso_tesoros,
    a.buscar_perlas,
    a.lectura_biblia,
    a.empiece_conversaciones,
    a.haga_revisitas,
    a.explique_creencias,
    a.discurso_estudiantil,
    a.vida_cristiana,
    a.conductor_estudio,
    a.lector_estudio
ORDER BY ultima_participacion ASC NULLS FIRST;

-- ==========================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ==========================================
ALTER TABLE participantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE aptitudes_participante DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_asignaciones DISABLE ROW LEVEL SECURITY;
