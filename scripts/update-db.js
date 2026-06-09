const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Leer archivo .env manualmente para extraer la contraseña
let password = '';
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const match = envContent.match(/SUPABASE_DB_PASSWORD\s*=\s*(.*)/);
  if (match && match[1]) {
    password = match[1].trim();
  }
} catch (e) {
  console.log("No se pudo leer .env, usando contraseña por defecto.");
}

const config = {
  host: process.env['SUPABASE_DB_HOST'] || 'db.eoruialtlcnxhgckkzjh.supabase.co',
  port: parseInt(process.env['SUPABASE_DB_PORT'] || '5432'),
  user: process.env['SUPABASE_DB_USER'] || 'postgres',
  password: password,
  database: process.env['SUPABASE_DB_NAME'] || 'postgres',
  ssl: { rejectUnauthorized: false }
};

const query = `
-- 1. Agregar columnas a la tabla de aptitudes
ALTER TABLE aptitudes_participante ADD COLUMN IF NOT EXISTS presidente BOOLEAN DEFAULT FALSE;
ALTER TABLE aptitudes_participante ADD COLUMN IF NOT EXISTS oracion_inicio BOOLEAN DEFAULT FALSE;
ALTER TABLE aptitudes_participante ADD COLUMN IF NOT EXISTS oracion_conclusion BOOLEAN DEFAULT FALSE;

-- 2. Eliminar la vista si existe para evitar errores de cambio de nombres de columnas
DROP VIEW IF EXISTS v_candidatos_rotacion;

-- 3. Crear de nuevo la vista de candidatos para incluir las nuevas columnas
CREATE VIEW v_candidatos_rotacion AS
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
    a.haga_discipulos,
    a.explique_creencias,
    a.que_diria,
    a.discurso_estudiantil,
    a.vida_cristiana,
    a.conductor_estudio,
    a.lector_estudio,
    a.ayudante,
    a.presidente,
    a.oracion_inicio,
    a.oracion_conclusion,
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
    a.haga_discipulos,
    a.explique_creencias,
    a.que_diria,
    a.discurso_estudiantil,
    a.vida_cristiana,
    a.conductor_estudio,
    a.lector_estudio,
    a.ayudante,
    a.presidente,
    a.oracion_inicio,
    a.oracion_conclusion
ORDER BY ultima_participacion ASC NULLS FIRST;
`;

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Conectado a la base de datos de Supabase.');
    await client.query(query);
    console.log('¡Base de datos actualizada con éxito!');
  } catch (err) {
    console.error('Error durante la actualización:', err);
  } finally {
    await client.end();
  }
}
main();
