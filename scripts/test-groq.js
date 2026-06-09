const apiKey = process.env.GROQ_API_KEY;

async function testGroq() {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Dime "Hola mundo" y nada mas.' }],
    temperature: 0.1
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      console.log('✅ GROQ API WORKS: ', data.choices[0].message.content);
    } else {
      console.log('❌ GROQ API ERROR: ', data);
    }
  } catch (err) {
    console.log('❌ FETCH ERROR: ', err.message);
  }
}

testGroq();
