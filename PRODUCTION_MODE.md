# 🚀 Production Mode - Real M-Pesa Testing Guide

## Status: SWITCHED TO PRODUCTION! ✅

Your app is now configured with **live Lipana credentials**:
- **Secret Key**: `lip_sk_live_...` ✅
- **Environment**: `production` ✅
- **Mode**: Real M-Pesa payments enabled ✅

## What Changed

| Feature | Before | After |
|---------|--------|-------|
| API Key | `lip_sk_test_...` | `lip_sk_live_...` ✅ |
| M-Pesa Prompts | Simulated (none) | **Real STK Push** ✅ |
| Test Mode | Yes | **Production** ✅ |
| Real Money | No | **Yes** ⚠️ |

## Important ⚠️ READ CAREFULLY

### You Now Have LIVE M-Pesa Payments Enabled

When you trigger a payment:
- ✅ Real M-Pesa prompt will appear on the customer's phone
- ✅ Real money will be charged if they complete payment
- ⚠️ **This is not a test!** Real funds transfer!

### Before Testing

**Checklist**:
- [ ] You understand real money will be charged
- [ ] You have a test M-Pesa number you can use
- [ ] You have funds available for testing
- [ ] You've verified the phone number is correct
- [ ] Your Lipana account is fully set up

## How to Test Now

### Step 1: Enter Real Phone Number
When prompted for phone number, use:
- **Your real M-Pesa registered number** (e.g., `0712345678` or `+254712345678`)
- Must be a valid Kenyan M-Pesa account
- You must have funds to complete the test

### Step 2: Trigger Payment
1. Add guest to table
2. Add items to order
3. Click "Process Payment"
4. Enter your real M-Pesa phone number
5. Click "Send Payment Request"

### Step 3: Complete Payment on Phone
1. You'll receive M-Pesa STK Push prompt
2. Enter your M-Pesa PIN to authorize
3. Payment completes
4. Webhook is called automatically
5. Guest status → "Paid" ✅

### Step 4: Verify in App
- Guest status should change to "Paid"
- Table should show as "Available" (if all guests paid)

## Payment Flow (Production)

```
User enters phone
         ↓
App calls Lipana API
         ↓
✅ Returns transactionId
         ↓
Guest status → pending_payment
         ↓
🔔 Real M-Pesa STK Push appears on phone
         ↓
Customer enters M-Pesa PIN
         ↓
Payment processes (real money)
         ↓
Lipana sends webhook callback
         ↓
App receives webhook
         ↓
Guest status → paid ✅
         ↓
Table status → available ✅
```

## Test Amounts

For testing, use small amounts:
- **Minimum**: KES 10
- **Recommended for testing**: KES 50-100
- **Maximum**: Depends on your M-Pesa limits

## Troubleshooting

### "No STK Push appeared"
**Causes**:
- Phone number format wrong (try with leading 0 or +254)
- Phone not registered for M-Pesa
- Lipana account issue
- Network connectivity

**Fix**:
1. Verify phone number format
2. Ensure M-Pesa account has balance
3. Check network connection
4. Try again with different amount

### "STK Push appeared but payment failed"
**Causes**:
- Insufficient M-Pesa balance
- Wrong PIN entered
- Account restrictions
- Network timeout during payment

**Fix**:
1. Check M-Pesa balance
2. Try with smaller amount
3. Ensure good network connection
4. Try payment again

### "Payment succeeded but guest still pending"
**Causes**:
- Webhook didn't process
- Guest not found in database
- Transaction ID mismatch

**Fix**:
1. Check webhook logs: `supabase functions logs lipana-webhook`
2. Verify transaction_id is stored on guest
3. Try payment again

## Test Scenarios

### Scenario 1: Successful Payment
```
Phone: Your M-Pesa number
Amount: KES 50
Result: STK appears → Enter PIN → Payment succeeds → Guest = Paid ✅
```

### Scenario 2: Payment Fails
```
Phone: Your M-Pesa number
Amount: More than balance
Result: STK appears → Insufficient balance → Guest = pending_payment
```

### Scenario 3: Multiple Guests
```
Guest 1: Phone A, Amount KES 100 → Paid ✅
Guest 2: Phone B, Amount KES 50 → Paid ✅
Table: All guests paid → Table = Available ✅
```

## Webhook Testing (if payment doesn't complete)

If STK Push doesn't work, test webhook manually:

```bash
# Get the transactionId from console logs
# Then simulate successful payment:

curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "TXN_ID_FROM_LOGS",
      "amount": 50,
      "phone": "+254712345678",
      "status": "success"
    }
  }'
```

## Switching Back to Sandbox (if needed)

To go back to test mode:

**In `.env`**:
```dotenv
EXPO_PUBLIC_LIPANA_SECRET_KEY=your_test_key_from_env
EXPO_PUBLIC_LIPANA_ENVIRONMENT=sandbox
```

Then: `npx expo start --clear`

## Important Security Notes

⚠️ **NEVER**:
- Commit production keys to git (even in private repos - use .env)
- Share API keys with anyone
- Store keys in frontend code
- Log keys to console
- Include keys in documentation

✅ **ALWAYS**:
- Keep webhook secret safe
- Use .env files for secrets
- Verify transactions on backend
- Use HTTPS for all requests
- Monitor transaction logs
- Use GitHub Secrets for CI/CD

## Support

If issues occur:
1. Check webhook logs: `supabase functions logs lipana-webhook`
2. Check console logs in app
3. Visit Lipana status: https://status.lipana.dev
4. Contact Lipana support: https://lipana.dev/support

## Summary

Your app is now **live with real M-Pesa payments**! 🎉

- Enter your real phone number
- Trigger payment
- Complete on phone
- See guest marked as paid

**Remember**: Real money will be charged, so test carefully!
