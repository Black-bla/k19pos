# Complete Implementation Plan

## Phase 1: Payment System (Critical - 2-3 hours) ✅ COMPLETE

### 1.1 Payment Amount Calculation ✅
**Files modified:**
- `app/(tabs)/index.tsx` - handleTriggerPayment function

**Status:** COMPLETE
- Guest orders fetched from `guest_orders` table
- Total calculated: `SUM(price_snapshot * quantity)`
- Amount passed to payment modal state
- Itemized breakdown displayed in payment modal

### 1.2 Lipana Payment Integration ✅
**Files created/modified:**
- `lib/lipana.ts` - Lipana API integration (lipana.dev)
- `app/(tabs)/index.tsx` - Payment modal with phone input
- `supabase/functions/lipana-webhook/index.ts` - Webhook handler
- `supabase/migrations/20251206_add_payment_tracking.sql` - Database schema

**Status:** COMPLETE - Production Ready
- Lipana SDK/API integration fully configured
- Phone number input field with Kenya format validation (254XXXXXXXXX)
- Payment record created in `payments` table
- Payment states fully implemented: pending → pending_payment → success
- Guest status automatically updates to 'paid' when payment succeeds
- Payment progress indicator implemented
- Payment failures/timeouts handled
- Webhook endpoint deployed and processing callbacks
- Real-time database updates via Supabase subscriptions
- Environment variables configured for production
- Production API keys active (lip_sk_live_...)

**API Flow Completed:**
```
✅ User enters phone number
✅ Format validated (254...)
✅ Payment record created (status: pending)
✅ Lipana STK Push API called
✅ Real M-Pesa prompt appears on customer phone
✅ Customer enters M-Pesa PIN
✅ Lipana webhook receives payment callback
✅ Payment record updated (success/failed)
✅ Guest status updated to 'paid'
✅ Table status updated to 'available' when all guests paid
✅ Daily payments list shows all transactions
```

**Additional Features Implemented:**
- Daily payments list screen with real-time summary statistics
- Filter payments by waiter to see who brought in the most revenue
- Pull-to-refresh functionality on payments page
- Color-coded status badges (success, failed, pending)
- Currency formatting (KES) and time formatting
- Guest info with transaction ID, phone, amount, time, and waiter name

---

## Phase 2: Order Management (1-2 hours)

### 2.1 View Existing Orders Before Adding More
**Files to modify:**
- `components/screens/OrderTakingScreen.tsx`

**Tasks:**
1. Fetch existing orders for the guest on screen load
2. Display existing orders at the top in a summary section
3. Show total of current orders
4. Add button to continue adding more items

### 2.2 Order Editing/Cancellation
**Files to modify:**
- `components/screens/OrderTakingScreen.tsx`
- Add edit mode toggle

**Tasks:**
1. Add "Edit Orders" button that shows existing orders
2. For each order item, add delete button (trash icon)
3. For drinks, allow quantity adjustment with +/- buttons
4. Confirm deletion with alert
5. Update guest status if all orders removed (back to pending)
6. Real-time sync with table modal and guests screen

**UI Flow:**
```
[View Mode] - Shows existing orders (read-only)
  └─ [+ Add More Items] button → Add new items
  └─ [Edit Orders] button → Edit mode

[Edit Mode] - Existing orders with controls
  └─ Each item has [X] delete button
  └─ Drinks have +/- quantity controls
  └─ [Done] button → Back to view mode
```

---

## Phase 3: Kitchen Screen (2-3 hours)

### 3.1 Kitchen Dashboard Screen
**New files to create:**
- `app/(tabs)/kitchen.tsx` - Kitchen screen
- `components/KitchenOrderCard.tsx` - Order card component
- `hooks/useKitchenOrders.ts` - Fetch orders hook

**Database changes needed:**
- Add `status` field to `guest_orders` table: 
  - `pending` (just ordered)
  - `preparing` (chef started)
  - `ready` (ready to serve)
  - `served` (delivered to guest)

**Tasks:**
1. Create kitchen tab in tab navigation
2. Display all orders grouped by table
3. Show order details: table name, seat number, guest name, items
4. Color-code by status:
   - Red/Orange: pending (new orders)
   - Yellow: preparing
   - Green: ready
   - Gray: served
5. Add status buttons to advance order items
6. Show timestamp (time since ordered)
7. Filter by status
8. Real-time updates via Supabase subscription

**Layout:**
```
┌─────────────────────────────────┐
│ Kitchen Orders                  │
│ [All] [Pending] [Preparing]     │
├─────────────────────────────────┤
│ ┌─────────────────────────┐    │
│ │ Table 1 - Seat 2        │    │
│ │ Guest: John Doe         │    │
│ │ • 1x Chicken Rice       │    │
│ │ • 1x Soda               │    │
│ │ [Start] [Ready]         │    │
│ │ Ordered 5 mins ago      │    │
│ └─────────────────────────┘    │
```

---

## Phase 4: Waiter Assignment & Filtering (1 hour)

### 4.1 Waiter Assignment
**Files to modify:**
- `app/(tabs)/index.tsx` - Tables screen (already has waiter dropdown)
- `components/TableDetail.tsx` - Show assigned waiter

**Tasks:**
1. Verify waiter assignment works when seating guests
2. Display assigned waiter name in guest card
3. Allow reassigning waiter from table modal

### 4.2 Waiter Filtering
**Files to modify:**
- `app/(tabs)/guests.tsx` - Add waiter filter
- `app/(tabs)/kitchen.tsx` - Add waiter filter (if implemented)

**Tasks:**
1. Add waiter filter dropdown to guests screen
2. Fetch list of staff from `staff_profiles`
3. Filter guests/orders by assigned waiter
4. Show waiter name in guest cards

---

## Phase 5: Reservations (1-2 hours)

### 5.1 Reservations Screen
**Files to modify:**
- `app/(tabs)/reservations.tsx`
- Create reservation management UI

**Tasks:**
1. List upcoming reservations
2. Create new reservation form:
   - Guest name
   - Phone number
   - Date & time
   - Party size
   - Table selection (optional)
3. Reservation statuses:
   - `pending` (upcoming)
   - `seated` (arrived and seated)
   - `cancelled`
   - `no_show`
4. Mark as seated → Auto-create guests at table
5. Send SMS reminders (optional, requires SMS API)

---

## Priority Order Recommendation:

### **Immediate (Must Have - Week 1):**
1. ✅ Payment Amount Calculation - 30 mins
2. ✅ Lipana Payment Integration - 2-3 hours
3. ✅ View Existing Orders - 30 mins

### **High Priority (Should Have - Week 2):**
4. ✅ Order Editing/Cancellation - 1-2 hours
5. ✅ Kitchen Screen - 2-3 hours

### **Medium Priority (Nice to Have - Week 3):**
6. ✅ Waiter Filtering - 1 hour
7. ✅ Reservations - 1-2 hours

---

## Technical Considerations:

### Database Schema Updates Needed:
```sql
-- Add status to guest_orders
ALTER TABLE guest_orders 
ADD COLUMN status TEXT DEFAULT 'pending';

-- Create payments table if not exists
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id UUID REFERENCES guests(id),
  phone_number TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  mpesa_receipt_number TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_guest_orders_status ON guest_orders(status);
CREATE INDEX idx_payments_guest_id ON payments(guest_id);
CREATE INDEX idx_payments_status ON payments(status);
```

### External Services Required:
1. **Lipana (lipana.dev):**
   - API Key (from Lipana dashboard)
   - Webhook URL (for payment confirmations)
   - Handles M-Pesa payments internally
   - No need for direct M-Pesa Daraja API setup
2. **Optional SMS Service:**
   - Africa's Talking or similar
   - For reservation reminders

### Environment Variables Needed:
```
LIPANA_API_KEY=
LIPANA_WEBHOOK_SECRET=
LIPANA_CALLBACK_URL=
```

---

## Current Status:

### ✅ PHASE 1 COMPLETE - Payment System Fully Functional:
- Payment amount calculation from guest orders (working)
- Lipana M-Pesa STK Push integration (production, live payments)
- Payment modal with phone number input and validation
- Real-time guest status updates (pending → pending_payment → paid)
- Automatic table availability updates when all guests pay
- Payment webhook processing and callback handling
- Database schema complete with payments table and tracking
- Daily payments list screen with summary statistics
- Waiter performance filtering (see who brought in most revenue)
- Pull-to-refresh and real-time updates
- Currency and time formatting
- Production API keys configured and active

### ⚠️ Incomplete Features:
- Order editing/cancellation (Phase 2)
- Kitchen screen (Phase 3)
- Waiter filtering for orders (Phase 4)
- Reservations functionality (Phase 5)

---

## Next Steps:
Proceed to **Phase 2 (Order Management)** - View existing orders and order editing/cancellation.
