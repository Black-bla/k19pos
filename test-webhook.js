// Test webhook locally
// Run: node test-webhook.js

const crypto = require('crypto');

const WEBHOOK_URL = 'https://fzcdimeuloecsxoqcmyr.functions.supabase.co/lipana-webhook';
const WEBHOOK_SECRET = '00892041c19432740852aac8d16c3fe8e46a44190069042c74ed0d27021b9561';

// Test payload (success)
const payload = {
  event: 'payment.success',
  data: {
    transactionId: 'TEST_TXN_123',
    amount: 100,
    currency: 'KES',
    status: 'success',
    phone: '+254712345678',
    checkoutRequestID: 'ws_CO_TEST123',
    timestamp: new Date().toISOString()
  }
};

const payloadStr = JSON.stringify(payload);

// Generate signature
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadStr)
  .digest('hex');

console.log('Testing webhook with payload:', payloadStr);
console.log('Signature:', signature);

// Send request
fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-lipana-signature': signature
  },
  body: payloadStr
})
  .then(res => {
    console.log('Status:', res.status);
    return res.text();
  })
  .then(text => {
    console.log('Response:', text);
  })
  .catch(err => {
    console.error('Error:', err.message);
  });
