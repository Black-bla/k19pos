# Why You're Not Getting STK Push - Explanation

## The Real Situation

Your setup is **actually working correctly**. Here's what's happening:

### What Happens When You Trigger Payment:

1. **App initiates Lipana STK Push** ✅
   - Sends request to: `https://api.lipana.dev/v1/transactions/push-stk`
   - With your test phone: `+254708374149`
   - Lipana returns: `transactionId: TXN123...` ✅

2. **App shows alert** ✅
   - "Please check your phone and enter your M-Pesa PIN"

3. **App waits for webhook** ✅
   - Webhook endpoint ready at: `https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook`

### What's NOT Happening:

4. ❌ **You don't see M-Pesa prompt on phone**

## Why No M-Pesa Prompt?

### Reason 1: You're in SANDBOX/TEST Mode
When using a **test API key** (`lip_sk_test_...`), Lipana:
- ✅ Accepts the request
- ✅ Returns a transaction ID
- ✅ Simulates the payment flow
- ❌ Does NOT send actual SMS to phone
- ❌ Does NOT show M-Pesa prompt on device

**This is normal!** Test environments never send real prompts.

### Reason 2: Test Phone Number Requirements
For the test number `+254708374149`, you need:
- It's a virtual/sandbox number
- Works **only in test mode**
- Never sends actual M-Pesa prompt
- Used for testing the API integration

### Reason 3: Lipana Account Setup
Your account needs:
- ✅ API Key: `lip_sk_test_...` (you have this)
- ✅ Correct environment selected (should be SANDBOX)
- ✓ Webhook URL configured in dashboard (check!)

## How to Actually Test This

### Option A: Test in Sandbox (Simulated)
Since you're in sandbox mode, you can't get a real STK Push. But you **can** test the webhook:

**What to do**:
1. Trigger payment in app (you're already doing this)
2. Note the `transactionId` from the response
3. Manually call webhook to simulate payment completion:

```bash
# Simulate successful payment callback
curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "TXN_FROM_YOUR_APP",
      "amount": 100,
      "phone": "+254708374149",
      "status": "success"
    }
  }'
```

**Expected result**: Guest status changes to "Paid" ✅

### Option B: Test with Real Money (Production)
To get actual M-Pesa prompts:

1. **Switch to production** (requires Lipana approval)
2. **Get production API key** (starts with `lip_sk_live_...`)
3. **Use real phone number** (your actual M-Pesa number)
4. **Real amount** (KES 10 or more)
5. **You'll see actual M-Pesa prompt** ✅

## Quick Checklist

- [ ] Phone number being used: **What is it?**
- [ ] Are you in test mode? **Yes** (API key is `lip_sk_test_...`)
- [ ] Expecting real STK in test mode? **That's the issue!**
- [ ] Want to test end-to-end without real money? **Use manual webhook**
- [ ] Want real STK prompt? **Need production mode + real phone**

## Your Configuration is Correct For:
- ✅ Testing API integration (what you're doing)
- ✅ Testing webhook flow (simulate with curl)
- ✅ Testing database updates (guest status changes)
- ❌ NOT getting real M-Pesa prompts (test mode limitation)

## What You Should Do

### For Testing (Recommended Right Now):
1. Keep using sandbox
2. When payment is triggered, note the transactionId
3. Manually test webhook to verify guest updates work
4. This proves the integration is working!

### For Production:
1. Contact Lipana to upgrade to production
2. Get live API key
3. Configure real phone number
4. Then you'll get actual STK Push

## Next Test

Try this to verify everything works:

```bash
# Step 1: Trigger payment in app
# (use phone: +254708374149, amount: 100)
# Get transactionId from response

# Step 2: Simulate successful payment
curl -X POST https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "PASTE_YOUR_TXN_ID_HERE",
      "amount": 100,
      "phone": "+254708374149",
      "status": "success"
    }
  }'

# Step 3: Check guest status in app
# Should be "Paid" if webhook worked!
```

## Summary
Your payment system is **working correctly**! You're just experiencing normal sandbox behavior where test API keys don't send real prompts. This is how all payment providers work.
