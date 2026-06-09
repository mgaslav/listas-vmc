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

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Conectado a la base de datos de Supabase.');

    // 1. Activar 'presidente' para todos los Ancianos y Siervos Ministeriales (varones)
    const resPresidente = await client.query(`
      UPDATE aptitudes_participante ap
      SET presidente = TRUE
      FROM participantes p
      WHERE ap.id_participante = p.id
        AND p.genero = 'Hombre'
        AND p.rol IN ('Anciano', 'Siervo Ministerial')
        AND p.activo = TRUE
    `);
    console.log(`✅ Presidente activado para ${resPresidente.rowCount} participante(s) (Ancianos y SM).`);

    // 2. Activar 'oracion_inicio' para todos los varones bautizados (Anciano, SM, Publicador)
    const resOracionInicio = await client.query(`
      UPDATE aptitudes_participante ap
      SET oracion_inicio = TRUE
      FROM participantes p
      WHERE ap.id_participante = p.id
        AND p.genero = 'Hombre'
        AND p.rol IN ('Anciano', 'Siervo Ministerial', 'Publicador')
        AND p.activo = TRUE
    `);
    console.log(`✅ Oración de Inicio activada para ${resOracionInicio.rowCount} participante(s) (varones bautizados).`);

    // 3. Activar 'oracion_conclusion' para todos los varones bautizados (Anciano, SM, Publicador)
    const resOracionConclusion = await client.query(`
      UPDATE aptitudes_participante ap
      SET oracion_conclusion = TRUE
      FROM participantes p
      WHERE ap.id_participante = p.id
        AND p.genero = 'Hombre'
        AND p.rol IN ('Anciano', 'Siervo Ministerial', 'Publicador')
        AND p.activo = TRUE
    `);
    console.log(`✅ Oración de Conclusión activada para ${resOracionConclusion.rowCount} participante(s) (varones bautizados).`);

    // 4. Verificar: mostrar participantes actualizados
    const { rows } = await client.query(`
      SELECT p.nombre_completo, p.rol, p.genero, 
             ap.presidente, ap.oracion_inicio, ap.oracion_conclusion
      FROM participantes p
      JOIN aptitudes_participante ap ON p.id = ap.id_participante
      WHERE p.activo = TRUE
        AND (ap.presidente = TRUE OR ap.oracion_inicio = TRUE OR ap.oracion_conclusion = TRUE)
      ORDER BY p.nombre_completo
    `);
    
    console.log('\n📋 Participantes con asignaciones de introducción/conclusión:');
    console.table(rows);

  } catch (err) {
    console.error('Error durante la actualización:', err);
  } finally {
    await client.end();
  }
}
main();
