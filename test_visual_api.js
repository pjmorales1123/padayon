const URL = 'https://padayon-theta.vercel.app/api/agent';
const userId = 'maria-demo-' + Date.now();

async function test() {
  console.log('Sending visual request...');
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message: 'Show me a visual for photosynthesis' }),
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response length:', text.length);
  try {
    const json = JSON.parse(text);
    console.log('Classification:', json.classification);
    console.log('Has interactive:', !!json.interactive);
    console.log('Interactive type:', json.interactive?.type);
    console.log('Reply:', json.reply?.slice(0, 200));
    if (json.interactive?.type === 'html_visual') {
      console.log('HTML length:', json.interactive.html?.length);
      console.log('HTML preview:', json.interactive.html?.slice(0, 200));
    }
  } catch {
    console.log('Not JSON:', text.slice(0, 500));
  }
}

test().catch(e => console.error(e));
