# STK Push Not Appearing - Debugging Guide

## Current Status
- ✅ Lipana API call succeeds (returns transactionId)
- ✅ Response parsed correctly
- ❌ Phone doesn't receive M-Pesa prompt

## Common Causes

### 1. **Wrong Test Phone Number**
Lipana provides specific sandbox test numbers that trigger STK Push:
- **Success (STK appears)**: `+254708374149`
- **Failure (STK appears but payment fails)**: `+254708374150`

**What you tried**: Check the phone number you entered

**Fix**: 
- Try exactly: `+254708374149` (with + sign)
- Or try: `254708374149` (without +)
- Or try: `0708374149` (with leading 0)

### 2. **Lipana Account Not in Sandbox Mode**
Your account might be set to production instead of sandbox.

**Check**:
1. Go to https://dashboard.lipana.dev
2. Look for environment toggle (usually top-right)
3. Make sure it says **SANDBOX** or **TEST**
4. Your API key starts with `lip_sk_test_` ✓ (you have this correct)

### 3. **Webhook URL Not Configured in Lipana Dashboard**
If webhook URL is missing, Lipana won't send callbacks but STK Push might still work.

**Check**:
1. Go to https://dashboard.lipana.dev
2. Settings → Webhooks
3. Add/verify: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook`
4. Enable: payment.success, payment.failed

### 4. **Phone Number Format Issue**
Lipana is very picky about phone format.

**What's being sent** (check console logs):
```
Phone formatting logic:
- Input: "0708374149" → Output: "+254708374149"
- Input: "708374149" → Output: "+254708374149"
- Input: "254708374149" → Output: "+254708374149"
- Input: "+254708374149" → Output: "+254708374149"
```

**Test with different formats**:
- `0708374149`
- `254708374149`
- `+254708374149`
- `+254708374149` (explicitly with plus)

### 5. **Real Phone vs Sandbox**
In **sandbox mode**, the STK Push is simulated. You won't get an actual M-Pesa prompt.

**What happens in sandbox**:
1. ✅ API returns success
2. ✅ Transaction ID created
3. ❌ No actual SMS/STK appears on phone
4. ✅ Webhook simulation can be triggered manually

**To test webhook in sandbox**:
```bash
curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "TXN123...",
      "amount": 100,
      "phone": "+254708374149",
      "status": "success"
    }
  }'
```

## Debugging Steps

### Step 1: Verify Response Parsing
Check console logs for:
```
LOG  Lipana STK Push Parsed Response: {...}
```

Should show:
```json
{
  "success": true,
  "message": "STK push initiated successfully",
  "data": {
    "transactionId": "TXN...",
    "status": "pending",
    "checkoutRequestID": "...",
    "message": "..."
  }
}
```

### Step 2: Check What Phone Number Was Sent
In console, look for:
```
Phone formatting: 0708374149 → +254708374149
```

### Step 3: Verify Lipana Configuration
```bash
# Check your API key (from .env)
cat .env | grep LIPANA_SECRET_KEY
# Should start with: lip_sk_test_

# Check webhook secret
cat supabase/functions/.env | grep LIPANA_WEBHOOK_SECRET
```

### Step 4: Test Lipana Directly
Use Lipana's test endpoint directly:
```bash
curl -X POST https://api.lipana.dev/v1/transactions/push-stk \
  -H "Content-Type: application/json" \
  -H "x-api-key: lip_sk_test_YOUR_KEY" \
  -d '{
    "phone": "+254708374149",
    "amount": 100,
    "accountReference": "TEST",
    "transactionDesc": "Test"
  }'
```

## What to Check First

1. **Are you using the correct sandbox test number?**
   - Try: `+254708374149`

2. **Is your Lipana account in sandbox/test mode?**
   - Check dashboard.lipana.dev

3. **Are you expecting actual M-Pesa prompt in sandbox?**
   - In sandbox, STK is simulated
   - Use test webhook to simulate completion

4. **Did you update app and reload?**
   - The phone number formatting fix was just applied
   - Full restart might be needed: `npx expo start --clear`

## Next Steps

### If you want to test end-to-end in SANDBOX:

1. **Trigger payment with test number**: `+254708374149`
2. **Don't wait for real STK** (it's sandbox)
3. **Manually trigger webhook** with:
   ```bash
   curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": "payment.success",
       "data": {
         "transactionId": "TXN_FROM_YOUR_ATTEMPT",
         "amount": 100,
         "phone": "+254708374149",
         "status": "success"
       }
     }'
   ```
4. **Check guest status** - Should now be "Paid"

### If you want to test with REAL M-Pesa:

1. **Switch to production** (requires Lipana approval)
2. **Use real phone number**: Your actual M-Pesa account
3. **Use real amount** (at least KES 10)
4. **Actual STK Push will appear**

## Lipana Documentation Links
- API Docs: https://lipana.dev/docs
- Dashboard: https://dashboard.lipana.dev
- Status: https://status.lipana.dev

## Current Configuration
```
API Key: (stored in .env - keep secret!)
Environment: sandbox
Webhook URL: https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook
Webhook Secret: (stored in supabase/functions/.env - keep secret!)
Min Amount: KES 10
Test Success Number: +254708374149
Test Failure Number: +254708374150
```

## Questions to Answer

1. What phone number did you enter?
2. Did it have + sign or without?
3. Are you seeing the transaction ID returned in console?
4. Can you see the "Payment Initiated" alert?
5. When you check the guest in the app, is status "pending_payment"?
