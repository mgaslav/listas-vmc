const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Datos de conexión a Supabase Postgres
const config = {
  host: process.env['SUPABASE_DB_HOST'] || 'db.eoruialtlcnxhgckkzjh.supabase.co',
  port: parseInt(process.env['SUPABASE_DB_PORT'] || '5432'),
  user: process.env['SUPABASE_DB_USER'] || 'postgres',
  password: process.env['SUPABASE_DB_PASSWORD'] || '',
  database: process.env['SUPABASE_DB_NAME'] || 'postgres',
  ssl: { rejectUnauthorized: false } // Requerido para conexiones a Supabase
};

const sqlFilePath = path.join(__dirname, '..', 'supabase_schema.sql');

async function deploy() {
  console.log('1. Leyendo archivo SQL...');
  let sqlContent;
  try {
    sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  } catch (err) {
    console.error('Error al leer el archivo sql:', err.message);
    process.exit(1);
  }

  console.log('2. Conectando a Supabase Postgres (db.eoruialtlcnxhgckkzjh.supabase.co)...');
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('¡Conexión establecida con éxito!');
    
    console.log('3. Ejecutando sentencias DDL (Tablas, Vistas y Políticas)...');
    await client.query(sqlContent);
    console.log('¡Base de datos e infraestructura SQL configurada con éxito!');
  } catch (err) {
    console.error('Error durante la ejecución del script SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

deploy();
