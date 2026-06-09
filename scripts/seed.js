const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://eoruialtlcnxhgckkzjh.supabase.co';
const supabaseKey = process.env['SUPABASE_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const firstNamesMale = ['Juan', 'Pedro', 'Miguel', 'Carlos', 'José', 'Luis', 'Alberto', 'Fernando', 'Ricardo', 'Javier', 'Daniel', 'Alejandro', 'Andrés', 'David', 'Diego', 'Gabriel', 'Héctor', 'Hugo', 'Iván', 'Jorge'];
const firstNamesFemale = ['María', 'Ana', 'Laura', 'Carmen', 'Sofía', 'Isabel', 'Marta', 'Lucía', 'Elena', 'Paula', 'Rosa', 'Teresa', 'Beatriz', 'Clara', 'Diana', 'Eva', 'Gloria', 'Inés', 'Julia', 'Sara'];
const lastNames = ['García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Gómez', 'Flores', 'Morales', 'Vázquez', 'Jiménez', 'Reyes', 'Díaz', 'Torres', 'Gutiérrez', 'Ruiz', 'Mendoza'];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(arr) {
  return arr[getRandomInt(0, arr.length - 1)];
}

function generateRandomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

async function seed() {
  console.log('Generating 80 participants...');
  const participantes = [];
  const aptitudes = [];
  const historial = [];

  for (let i = 0; i < 80; i++) {
    const isMale = Math.random() > 0.5;
    const genero = isMale ? 'Hombre' : 'Mujer';
    const nombre = isMale ? getRandomItem(firstNamesMale) : getRandomItem(firstNamesFemale);
    const apellido = getRandomItem(lastNames);
    const nombre_completo = `${nombre} ${apellido} ${i}`; // Ensure some uniqueness
    
    const isMenor = Math.random() < 0.15;
    const grupo_edad = isMenor ? 'Menor' : 'Mayor';
    
    let rol = 'Publicador';
    if (isMale && !isMenor) {
      const r = Math.random();
      if (r > 0.8) rol = 'Anciano';
      else if (r > 0.5) rol = 'Siervo Ministerial';
    } else if (!isMale || isMenor) {
      rol = Math.random() > 0.8 ? 'Publicador No Bautizado' : 'Publicador';
    }

    const activo = Math.random() > 0.05; // 95% active
    const condicion_especial = Math.random() > 0.9; // 10% special
    
    const ultima_participacion = Math.random() > 0.2 ? generateRandomDate(new Date(2025, 0, 1), new Date(2026, 5, 1)) : null;

    const id = crypto.randomUUID();

    participantes.push({
      id,
      nombre_completo,
      grupo_edad,
      genero,
      rol,
      condicion_especial,
      activo
    });

    if (ultima_participacion) {
      historial.push({
        id_participante: id,
        tipo_asignacion: 'lectura_biblia', // Mock assignment type
        fecha_reunion: ultima_participacion,
        es_ayudante: false
      });
    }

    // Generate aptitudes based on gender and role
    const isElderOrMS = rol === 'Anciano' || rol === 'Siervo Ministerial';
    
    aptitudes.push({
      id_participante: id,
      discurso_tesoros: isMale && isElderOrMS && Math.random() > 0.2,
      buscar_perlas: isMale && isElderOrMS && Math.random() > 0.2,
      lectura_biblia: isMale && Math.random() > 0.1,
      empiece_conversaciones: true, // Everyone does these
      haga_revisitas: Math.random() > 0.1,
      explique_creencias: Math.random() > 0.2,
      discurso_estudiantil: isMale && Math.random() > 0.3,
      vida_cristiana: isMale && isElderOrMS && Math.random() > 0.2,
      conductor_estudio: isMale && isElderOrMS && Math.random() > 0.1,
      lector_estudio: isMale && Math.random() > 0.2,
      ayudante: Math.random() > 0.3 // 70% chance of being helper
    });
  }

  console.log('Inserting into participantes...');
  // Upsert in batches to avoid limits
  for (let i = 0; i < participantes.length; i += 20) {
    const batchP = participantes.slice(i, i + 20);
    const { error } = await supabase.from('participantes').upsert(batchP);
    if (error) {
      console.error('Error inserting participantes:', error);
      return;
    }
  }

  console.log('Inserting into aptitudes_participante...');
  for (let i = 0; i < aptitudes.length; i += 20) {
    const batchA = aptitudes.slice(i, i + 20);
    const { error } = await supabase.from('aptitudes_participante').upsert(batchA);
    if (error) {
      console.error('Error inserting aptitudes:', error);
      return;
    }
  }

  console.log('Inserting into historial_asignaciones...');
  for (let i = 0; i < historial.length; i += 20) {
    const batchH = historial.slice(i, i + 20);
    const { error } = await supabase.from('historial_asignaciones').upsert(batchH);
    if (error) {
      console.error('Error inserting historial:', error);
      return;
    }
  }

  console.log('Successfully seeded 80 participants and their aptitudes!');
}

seed();
