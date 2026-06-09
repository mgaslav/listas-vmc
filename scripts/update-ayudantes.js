const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://eoruialtlcnxhgckkzjh.supabase.co';
const supabaseKey = process.env['SUPABASE_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAyudantes() {
  console.log('Obteniendo participantes que cumplen los criterios...');
  
  // Mujeres O (Hombres y NO Ancianos)
  const { data: participantes, error: fetchError } = await supabase
    .from('participantes')
    .select('id, nombre_completo, genero, rol');

  if (fetchError) {
    console.error('Error fetching participantes:', fetchError);
    return;
  }

  const idsToUpdate = participantes
    .filter(p => p.genero === 'Mujer' || (p.genero === 'Hombre' && p.rol !== 'Anciano'))
    .map(p => p.id);

  console.log(`Encontrados ${idsToUpdate.length} participantes que deben ser ayudantes.`);

  for (const id of idsToUpdate) {
    console.log(`Actualizando aptitudes_participante para id ${id}...`);
    const { error: updateError } = await supabase
      .from('aptitudes_participante')
      .update({ ayudante: true })
      .eq('id_participante', id);

    if (updateError) {
      console.error(`Error actualizando participante ${id}:`, updateError);
    }
  }

  console.log('¡Actualización completada!');
}

updateAyudantes();
