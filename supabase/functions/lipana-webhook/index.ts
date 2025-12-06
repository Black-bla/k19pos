import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const LIPANA_WEBHOOK_SECRET = Deno.env.get('LIPANA_WEBHOOK_SECRET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

if (!LIPANA_WEBHOOK_SECRET) {
  throw new Error('Missing LIPANA_WEBHOOK_SECRET');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function verifySignature(rawBody: string, signature: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LIPANA_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expectedBytes = encoder.encode(expectedHex);
  const signatureBytes = encoder.encode(signature);

  return constantTimeEqual(expectedBytes, signatureBytes);
}

async function updateGuestAndTableStatus(guestId: string, tableId: string | null, status: 'paid' | 'pending_payment') {
  await supabase.from('guests').update({ status }).eq('id', guestId);

  if (status !== 'paid' || !tableId) return;

  const { data: tableGuests } = await supabase
    .from('guests')
    .select('status')
    .eq('table_id', tableId);

  if (tableGuests && tableGuests.every((g: any) => g.status === 'paid')) {
    await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
  }
}

Deno.serve(async (req: Request) => {
  try {
    console.log('=== Webhook Request Started ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Timestamp:', new Date().toISOString());
    
    if (req.method !== 'POST') {
      console.log('Rejected: Not POST method');
      return new Response('Method not allowed', { status: 405 });
    }

    // Log all headers
    console.log('Headers:');
    for (const [key, value] of req.headers) {
      console.log(`  ${key}: ${value}`);
    }

    const signature = req.headers.get('x-lipana-signature');
    console.log('Signature header:', signature ? 'present' : 'MISSING');
    
    // Temporarily accept webhooks without signature for debugging
    // TODO: Enable signature verification once Lipana sends the header
    // if (!signature) {
    //   console.error('Missing x-lipana-signature header');
    //   return new Response('Missing signature', { status: 401 });
    // }

    let rawBody = '';
    try {
      rawBody = await req.text();
      console.log('Raw body length:', rawBody.length);
      console.log('Raw body:', rawBody);
    } catch (err) {
      console.error('Failed to read body:', err);
      return new Response('Failed to read body', { status: 400 });
    }

    // Verify signature if present
    if (signature) {
      const verified = await verifySignature(rawBody, signature);
      console.log('Signature verified:', verified);
      
      if (!verified) {
        console.error('Signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
    } else {
      console.warn('Proceeding without signature verification (debug mode)');
    }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
    console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Failed to parse webhook payload', err);
    return new Response('Bad Request', { status: 400 });
  }

  const { event, data } = payload;
  console.log('Event:', event);
  console.log('Data keys:', data ? Object.keys(data) : 'no data');
  console.log('Full data object:', JSON.stringify(data, null, 2));
  
  // Handle both camelCase and snake_case field names
  const transactionId: string | undefined = 
    data?.transactionId || 
    data?.transaction_id || 
    data?.TransactionId ||
    data?.id ||
    data?.ID;
    
  const amount: number | undefined = 
    data?.amount || 
    data?.Amount;
    
  const phone: string | undefined = 
    data?.phone || 
    data?.phoneNumber || 
    data?.phone_number || 
    data?.Phone ||
    data?.PhoneNumber;
    
  const status: string | undefined = 
    data?.status || 
    data?.Status;
    
  const checkoutRequestID: string | undefined = 
    data?.checkoutRequestID || 
    data?.checkout_request_id || 
    data?.CheckoutRequestID ||
    data?.checkoutRequestId ||
    data?.MerchantRequestID;

  console.log('Extracted fields:', { transactionId, amount, phone, status, checkoutRequestID });

  if (!transactionId) {
    console.error('Missing transactionId in webhook');
    console.error('Available data fields:', Object.keys(data || {}));
    console.error('Full payload structure:', JSON.stringify(payload, null, 2));
    return new Response(JSON.stringify({ 
      error: 'Missing transactionId',
      receivedFields: Object.keys(data || {}),
      payload: payload 
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (typeof amount !== 'number' || !phone) {
    console.error('Missing payment details:', { amount, phone });
    return new Response('Missing payment details', { status: 400 });
  }

  // Find guest by transaction_id
  const { data: guests, error: guestError } = await supabase
    .from('guests')
    .select('id, table_id')
    .eq('transaction_id', transactionId)
    .limit(1);

  if (guestError) {
    console.error('Guest lookup failed', guestError);
    return new Response('Server error', { status: 500 });
  }

  const guest = guests?.[0];
  if (!guest) {
    console.warn('No guest found for transaction', transactionId);
    return new Response('Not Found', { status: 404 });
  }

  const paymentStatus: 'pending' | 'success' | 'failed' =
    status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending';

  // Upsert payment record
  const { error: paymentError } = await supabase.from('payments').upsert({
    guest_id: guest.id,
    transaction_id: transactionId,
    amount,
    phone_number: phone,
    status: paymentStatus,
    checkout_request_id: checkoutRequestID,
    lipana_response: payload,
  }, { onConflict: 'transaction_id' });

  if (paymentError) {
    console.error('Payment upsert failed', paymentError);
    return new Response('Server error', { status: 500 });
  }

  if (paymentStatus === 'success') {
    console.log('Payment successful, updating guest to paid');
    await updateGuestAndTableStatus(guest.id, guest.table_id, 'paid');
  } else if (paymentStatus === 'failed') {
    console.log('Payment failed, keeping guest as pending_payment');
    await updateGuestAndTableStatus(guest.id, guest.table_id, 'pending_payment');
  }

  console.log('Webhook processed successfully');
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error?.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
