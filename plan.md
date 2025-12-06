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

## Phase 2: Order Management (1-2 hours) ✅ COMPLETE

### 2.1 View Existing Orders Before Adding More ✅
**Files modified:**
- `components/screens/OrderManagementScreen.tsx` - NEW

**Status:** COMPLETE
- Dedicated order management screen created
- Existing orders fetched and displayed for guest
- Shows itemized breakdown with prices
- Real-time order list with pull-to-refresh
- Order count displayed in header
- Empty state when no orders exist

### 2.2 Order Editing/Cancellation ✅
**Files modified:**
- `components/TableDetail.tsx` - Added "Edit Orders" button
- `components/screens/OrderManagementScreen.tsx` - Full editing interface
- `app/(tabs)/index.tsx` - Order management modal integration

**Status:** COMPLETE - Full Implementation
- Edit mode toggle in order management screen
- Individual item deletion with confirmation
- Quantity adjustment for drinks (decrement button)
- Real-time database updates
- Order total calculation
- Automatic UI refresh after changes
- Guest orders persist in real-time
- Empty states and error handling
- Smooth modal transitions

**Features:**
✅ View all orders for a guest with prices and quantities
✅ Edit mode with delete buttons for each item
✅ Quantity decrease buttons for drinks
✅ Confirmation alerts before deletion
✅ Real-time recalculation of order totals
✅ Visual edit/done toggle button
✅ Pull-to-refresh functionality
✅ Integration with table detail modal
✅ Automatic table and guest data updates when orders change

---

## Phase 3: Kitchen Screen (2-3 hours) ✅ COMPLETE

### 3.1 Kitchen Dashboard Screen ✅
**New files created:**
- `app/(tabs)/kitchen.tsx` - Kitchen screen with order management
- `supabase/migrations/20251206_add_order_status.sql` - Database schema update

**Status:** COMPLETE - Full Implementation

**Database changes applied:**
- Added `status` field to `guest_orders` table with values:
  - `pending` (just ordered)
  - `preparing` (chef started)
  - `ready` (ready to serve)
  - `served` (delivered to guest)
- Added index on status column for performance
- Default status is 'pending' for new orders

**Features Implemented:**
✅ Kitchen tab added to tab navigation with flame icon
✅ Display all active orders (excludes 'served' orders)
✅ Order cards grouped by table with guest information
✅ Color-coded status badges:
   - Red: pending (new orders)
   - Orange/Yellow: preparing
   - Green: ready
   - Gray: served
✅ Status progression buttons (Start → Ready → Served)
✅ Filter tabs: All, Pending, Preparing, Ready with counts
✅ Real-time updates via Supabase subscription
✅ Pull-to-refresh functionality
✅ Empty states for each filter
✅ Order details: table name, seat number, guest name, quantity, item name
✅ Visual status icons (time, flame, checkmark)
✅ Left border color indicator on cards
✅ Responsive design with proper spacing

**Migration Note:**
Run the SQL in `supabase/migrations/20251206_add_order_status.sql` or `apply_migration.sql` in the Supabase SQL Editor to add the status column to guest_orders table.

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

### ✅ PHASE 1, 2 & 3 COMPLETE - Payment, Order Management & Kitchen Systems Fully Functional:

**Phase 1 - Payment System:**
- Payment amount calculation from guest orders (working)
- Lipana M-Pesa STK Push integration (production, live payments)
- Payment modal with phone number input and validation
- Real-time guest status updates (pending → paid)
- Automatic table availability updates when all guests pay
- Payment webhook processing and callback handling
- Database schema complete with payments table and tracking
- Daily payments list screen with summary statistics
- Waiter performance filtering (see who brought in most revenue)
- Pull-to-refresh and real-time updates
- Currency and time formatting
- Production API keys configured and active

**Phase 2 - Order Management:**
- Dedicated order management screen with full editing capabilities
- View existing orders for each guest with prices and quantities
- Edit mode with individual item deletion and confirmation
- Quantity adjustment for drinks with decrement buttons
- Real-time order total calculations
- Automatic database updates and UI refresh
- Integration with table detail modal ("Edit Orders" button)
- Empty states and comprehensive error handling
- Pull-to-refresh functionality

**Phase 3 - Kitchen Screen:**
- Complete kitchen dashboard for order tracking
- Real-time order updates via Supabase subscriptions
- Four-stage order status workflow (pending → preparing → ready → served)
- Color-coded status badges and left border indicators
- Filter tabs with live counts (All, Pending, Preparing, Ready)
- Order cards showing table, seat, guest, item, and quantity
- Status progression buttons for kitchen staff
- Pull-to-refresh functionality
- Empty states for each filter
- Database migration for order status column

### ⚠️ Incomplete Features:
- Waiter filtering for orders (Phase 4)
- Reservations functionality (Phase 5)

---

## Next Steps:
Proceed to **Phase 4 (Waiter Assignment & Filtering)** - Add waiter filtering to guests and kitchen screens.
