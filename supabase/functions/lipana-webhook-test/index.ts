/**
 * Test webhook endpoint to see exactly what Lipana sends
 * This logs everything and returns the received payload
 */

Deno.serve(async (req: Request) => {
  console.log('=== TEST WEBHOOK RECEIVED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log ALL headers
  console.log('\n=== HEADERS ===');
  const headers: Record<string, string> = {};
  for (const [key, value] of req.headers) {
    headers[key] = value;
    console.log(`${key}: ${value}`);
  }
  
  // Read body
  const rawBody = await req.text();
  console.log('\n=== RAW BODY ===');
  console.log('Length:', rawBody.length);
  console.log('Content:', rawBody);
  
  // Try to parse as JSON
  let parsedBody: any = null;
  try {
    parsedBody = JSON.parse(rawBody);
    console.log('\n=== PARSED JSON ===');
    console.log(JSON.stringify(parsedBody, null, 2));
    
    if (parsedBody.data) {
      console.log('\n=== DATA OBJECT KEYS ===');
      console.log(Object.keys(parsedBody.data));
      
      console.log('\n=== DATA OBJECT VALUES ===');
      for (const [key, value] of Object.entries(parsedBody.data)) {
        console.log(`${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
      }
    }
  } catch (e) {
    console.log('Not valid JSON:', e.message);
  }
  
  // Return everything we received
  return new Response(
    JSON.stringify({
      received: true,
      timestamp: new Date().toISOString(),
      method: req.method,
      headers,
      rawBody,
      parsedBody,
      dataKeys: parsedBody?.data ? Object.keys(parsedBody.data) : [],
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
