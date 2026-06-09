const fs = require('fs');
const path = require('path');

// Leer archivo .env manualmente
let apiKey = '';
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const match = envContent.match(/OPENAI_API_KEY\s*=\s*(.*)/);
  if (match && match[1]) {
    apiKey = match[1].trim();
  }
} catch (e) {
  console.log("No se pudo leer .env.");
}

async function testOpenAI() {
  console.log("Probando OpenAI con api key:", apiKey.substring(0, 15) + "...");
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Hola, di ok' }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Conexión exitosa a OpenAI!");
      console.log("Respuesta:", data.choices[0].message.content);
    } else {
      const errorText = await response.text();
      console.log(`❌ Error de OpenAI (Status ${response.status}):`, errorText);
    }
  } catch (err) {
    console.log("❌ Error de red:", err.message);
  }
}

testOpenAI();
