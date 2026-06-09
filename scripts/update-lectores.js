const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://eoruialtlcnxhgckkzjh.supabase.co';
const supabaseKey = process.env['SUPABASE_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateLectores() {
  console.log('Obteniendo participantes varones...');
  
  const { data: participantes, error: fetchError } = await supabase
    .from('participantes')
    .select('id, nombre_completo, genero');

  if (fetchError) {
    console.error('Error fetching participantes:', fetchError);
    return;
  }

  const idsToUpdate = participantes
    .filter(p => p.genero === 'Hombre')
    .map(p => p.id);

  console.log(`Encontrados ${idsToUpdate.length} varones que deben tener lector_estudio = true.`);

  for (const id of idsToUpdate) {
    const { error: updateError } = await supabase
      .from('aptitudes_participante')
      .update({ lector_estudio: true })
      .eq('id_participante', id);

    if (updateError) {
      console.error(`Error actualizando participante ${id}:`, updateError);
    }
  }

  console.log('¡Actualización completada para lectores!');
}

updateLectores();
