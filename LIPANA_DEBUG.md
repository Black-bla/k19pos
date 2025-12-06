# Lipana Integration Debugging Guide

## Current Issues to Check

### 1. Webhook Configuration in Lipana Dashboard
- [ ] Go to https://dashboard.lipana.dev
- [ ] Navigate to Settings > Webhooks
- [ ] Verify webhook URL is set to: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook`
- [ ] Check which events are enabled (should include payment success/failed)
- [ ] Verify webhook secret matches: `00892041c19432740852aac8d16c3fe8e46a44190069042c74ed0d27021b9561`

### 2. Field Name Mismatches
The code expects these field names but Lipana might send different ones:
- `transactionId` vs `transaction_id` vs `TransactionId` vs `id`
- `phone` vs `phoneNumber` vs `phone_number`
- `checkoutRequestID` vs `checkout_request_id` vs `MerchantRequestID`

### 3. Webhook Signature Header
Lipana documentation says they send `x-lipana-signature` but we're not seeing it.
Possible alternatives:
- `X-Lipana-Signature` (capital letters)
- `x-signature`
- `lipana-signature`

### 4. Testing Steps

#### Step 1: Deploy Test Webhook
```bash
supabase functions deploy lipana-webhook-test --project-ref fzcdimeuloecsxoqcmyr --no-verify-jwt
```

Test URL: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook-test`

#### Step 2: Update Lipana Dashboard
Temporarily change webhook URL to the test endpoint to see raw payload

#### Step 3: Trigger Test Payment
Use sandbox number: `+254708374149` (success) or `+254708374150` (failure)

#### Step 4: Check Logs
```bash
supabase functions logs lipana-webhook-test --project-ref fzcdimeuloecsxoqcmyr
```

This will show EXACTLY what Lipana sends

#### Step 5: Update Main Webhook
Once you see the actual field names, update `lipana-webhook/index.ts` accordingly

### 5. Common Lipana API Issues

1. **Webhook not configured**: Lipana won't send callbacks if webhook URL not set in dashboard
2. **Wrong environment**: Sandbox vs Production webhooks are different
3. **SSL/HTTPS required**: Webhook URL must be HTTPS (Supabase functions are HTTPS ✓)
4. **IP Whitelisting**: Some providers require whitelisting Lipana's IPs
5. **Timeout**: Webhook must respond within 10 seconds

### 6. Expected Lipana Webhook Payload (from docs)

```json
{
  "event": "payment.success",
  "data": {
    "transactionId": "TXN123...",
    "amount": 100,
    "currency": "KES",
    "status": "success",
    "phone": "+254712345678",
    "checkoutRequestID": "ws_CO_...",
    "timestamp": "2024-12-06T12:00:00Z"
  }
}
```

But they might actually send:
```json
{
  "event": "payment.success",
  "data": {
    "transaction_id": "TXN123...",  // snake_case instead!
    "Amount": 100,                   // Capital letters!
    "phone_number": "+254712345678", // Different field name!
    // ... etc
  }
}
```

### 7. Manual Test with curl

Test the webhook directly:
```bash
curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook-test \
  -H "Content-Type: application/json" \
  -H "x-lipana-signature: test123" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "TEST123",
      "amount": 100,
      "phone": "+254712345678",
      "status": "success"
    }
  }'
```

### 8. Current Webhook Status
✅ Webhook receives calls from Lipana (confirmed in logs)
✅ Signature verification temporarily disabled for debugging
❌ Field extraction failing - transactionId not found
❌ Need to see actual Lipana payload structure

### 9. Next Steps
1. Deploy test webhook endpoint
2. Update Lipana dashboard to use test endpoint
3. Trigger payment with sandbox number
4. Check logs to see exact payload
5. Update main webhook with correct field names
6. Re-enable signature verification
7. Test end-to-end flow
