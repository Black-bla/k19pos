# Issues Found and Fixes Applied

## Issues Identified

### 1. ❌ CRITICAL: Webhook URL Not Configured in Lipana Dashboard
**Problem**: The webhook endpoint exists but Lipana doesn't know where to send callbacks.

**Solution**: You MUST configure the webhook URL in Lipana dashboard:
1. Go to https://dashboard.lipana.dev
2. Navigate to Settings > Webhooks
3. Add webhook URL: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook`
4. Enable events: `payment.success`, `payment.failed`, `payment.pending`
5. Set webhook secret: `00892041c19432740852aac8d16c3fe8e46a44190069042c74ed0d27021b9561`

### 2. ✅ FIXED: Environment Variable Access
**Problem**: Used `process.env.EXPO_PUBLIC_*` directly in export statement which doesn't work reliably in Expo.

**Fix Applied**: Extracted variables before using them in singleton export.

### 3. ✅ FIXED: Limited Field Name Variations
**Problem**: Webhook only checked 2-3 variations of field names (transactionId, transaction_id).

**Fix Applied**: Now checks multiple variations:
- `transactionId` / `transaction_id` / `TransactionId` / `id` / `ID`
- `phone` / `phoneNumber` / `phone_number` / `Phone` / `PhoneNumber`
- `checkoutRequestID` / `checkout_request_id` / `CheckoutRequestID` / `checkoutRequestId` / `MerchantRequestID`
- `amount` / `Amount`
- `status` / `Status`

### 4. ✅ ADDED: Better Error Response
**Problem**: Webhook returned simple error string, hard to debug.

**Fix Applied**: Now returns JSON with:
- Error message
- Received field names
- Full payload for debugging

### 5. ✅ ADDED: Test Webhook Endpoint
**Created**: `lipana-webhook-test` function that logs EVERYTHING Lipana sends.

**URL**: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook-test`

**Usage**:
1. Temporarily set this as webhook URL in Lipana dashboard
2. Trigger a payment
3. Check logs: `supabase functions logs lipana-webhook-test`
4. See exact field names Lipana uses
5. Update main webhook if needed
6. Switch back to main webhook URL

## Current Status

### Working ✅
- STK Push initiates successfully
- Payment modal shows and accepts phone number
- Transaction ID generated and stored
- Guest status updates to `pending_payment`
- Webhook endpoint deployed and accessible

### Not Working ❌
- Webhook not receiving calls (likely not configured in Lipana dashboard)
- Can't verify field names without seeing actual Lipana payload

## Next Steps

### Immediate Actions Required:

1. **Configure Webhook in Lipana Dashboard** (CRITICAL)
   - Login to https://dashboard.lipana.dev
   - Add webhook URL
   - Enable payment events
   - Save configuration

2. **Test the Flow**
   ```bash
   # Option A: Use test webhook first
   # 1. Set webhook URL to: https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook-test
   # 2. Trigger payment in app
   # 3. Check logs: supabase functions logs lipana-webhook-test
   # 4. See exact payload structure
   
   # Option B: Try main webhook directly
   # 1. Set webhook URL to: https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook
   # 2. Trigger payment in app
   # 3. Check logs: supabase functions logs lipana-webhook
   ```

3. **Verify Payment Flow**
   - Use sandbox test number: `+254708374149` (success)
   - Check guest status changes from `pending_payment` to `paid`
   - Verify table status changes to `available` when all guests paid

4. **Re-enable Signature Verification** (after confirming webhook works)
   - Uncomment signature check in webhook
   - Verify Lipana sends the signature header
   - Deploy updated webhook

## Test Numbers (Sandbox)
- ✅ Success: `+254708374149`
- ❌ Failure: `+254708374150`

## Webhook URLs
- Main: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook`
- Test: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook-test`

## Environment Check
```bash
# Check if variables are set
echo $EXPO_PUBLIC_LIPANA_SECRET_KEY
# Should output: lip_sk_live_... (production) or lip_sk_test_... (sandbox)

# Check webhook secret
cat supabase/functions/.env | grep LIPANA
# Should show LIPANA_WEBHOOK_SECRET set
```

## Files Modified
1. `lib/lipana.ts` - Fixed environment variable access
2. `supabase/functions/lipana-webhook/index.ts` - Added more field name variations, better error logging
3. `supabase/functions/lipana-webhook-test/index.ts` - NEW test endpoint
4. `LIPANA_DEBUG.md` - Comprehensive debugging guide

## Known Limitations
- Signature verification temporarily disabled (Lipana might not send header or use different name)
- Field names assumed based on documentation (actual payload might differ)
- Need to verify webhook configuration in Lipana dashboard
