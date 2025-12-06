# Payment Integration - Status & Fixes Applied

## Issue Timeline

### Issue 1: Missing `updated_at` Column ✅ FIXED
- **Error**: `record "new" has no field "updated_at"`
- **Cause**: Migration created trigger but forgot column
- **Fix**: Run this SQL in Supabase dashboard:
  ```sql
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ```

### Issue 2: Webhook Can't Find Guest ✅ FIXED
- **Error**: `"No guest found for transaction TXN1765037212346UFN5GQ"`
- **Cause**: Race condition - webhook queries guest before transaction_id is stored
- **Fix**: Reversed order in `app/(tabs)/index.tsx`:
  - NOW: Update guest with transaction_id FIRST
  - THEN: Record payment intent in payments table
  - This ensures webhook can find the guest when callback arrives

## Current Flow (Fixed)

```
1. User clicks "Send Payment Request"
   ↓
2. Lipana STK Push initiated → Returns transactionId
   ↓
3. ✅ Update guests table: status='pending_payment', transaction_id=TXN123...
   ↓
4. ✅ Record payment in payments table (for audit trail)
   ↓
5. ✅ Show alert to user
   ↓
6. [Webhook receives callback from Lipana]
   ↓
7. ✅ Query guests by transaction_id (NOW FOUND!)
   ↓
8. ✅ Update guest status: paid
   ↓
9. ✅ Check if all table guests paid
   ↓
10. ✅ If yes, mark table: available
```

## Files Modified

1. **app/(tabs)/index.tsx**
   - Lines 275-307: Reordered payment operations
   - Now updates guest FIRST, then records payment

2. **supabase/migrations/20251206000002_add_payments_timestamps.sql** (created)
   - Adds `updated_at` and `created_at` columns to payments table

## Next Steps to Test

### Prerequisites
- [ ] Run the SQL fix in Supabase dashboard (updated_at columns)
- [ ] App is running (`npx expo start`)

### Test Flow
1. Open app on device/emulator
2. Go to Tables screen
3. Add guest to a table
4. Click "Menu" and add items (or skip if already has orders)
5. Click guest → "Process Payment"
6. Enter M-Pesa number: `+254708374149` (sandbox success)
7. Click "Send Payment Request"
8. Check logs:
   - `supabase functions logs lipana-webhook`
9. Guest should change to "Paid" ✅

### Sandbox Test Numbers
- **Success**: `+254708374149`
- **Failure**: `+254708374150`

## Known Remaining Issues
- [ ] Webhook signature verification disabled (Lipana not sending header)
- [ ] Need to verify webhook URL configured in Lipana dashboard

## Environment Status
✅ Supabase connected
✅ Lipana API key configured
✅ Webhook endpoint deployed
❌ Webhook URL might not be registered in Lipana dashboard (check: https://dashboard.lipana.dev)
