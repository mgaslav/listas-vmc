const apiKey = process.env.GEMINI_API_KEY;

const tests = [
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-2.5-flash' },
  { version: 'v1beta', model: 'gemini-2.5-flash-preview-05-20' },
  { version: 'v1', model: 'gemini-2.0-flash' },
  { version: 'v1', model: 'gemini-2.5-flash' },
];

async function testModel({ version, model }) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde solo "ok"' }] }]
      })
    });
    if (response.ok) {
      console.log(`✅ ${version}/${model} — WORKS!`);
      return true;
    } else {
      const body = await response.json();
      const msg = body.error?.message?.substring(0, 100) || 'unknown';
      console.log(`❌ ${version}/${model} — (${response.status}): ${msg}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${version}/${model} — ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Key prefix: ${apiKey?.substring(0,10)}...\n`);
  for (const t of tests) {
    const ok = await testModel(t);
    if (ok) break;
  }
}
main();
