# K19POS - Complete System Overview

## **What It Is**
K19POS is a **lightweight, real-time restaurant point-of-sale system** designed for small to medium restaurants in Kenya. It enables staff to manage tables, take orders, process M-Pesa payments, and handle reservations—all from a mobile device.

---

## **Core Philosophy**
- **Mobile-first**: Built for tablets/phones, not desktop terminals
- **Real-time**: All staff see updates instantly (no refresh needed)
- **Zero friction**: Minimal taps from guest arrival to payment
- **Offline-resilient**: Cached data works even with spotty connection
- **M-Pesa native**: Integrated STK Push for seamless digital payments

---

## **Target Users**
1. **Waitstaff**: Take orders, manage tables, request payments
2. **Cashiers**: Process payments, track payment status
3. **Managers/Admins**: View analytics, manage menu, configure tables

---

## **System Architecture**

### **Frontend**
- **Framework**: React Native + Expo (iOS/Android/Web)
- **Navigation**: Expo Router (file-based routing)
- **State**: Supabase Realtime + Local React state
- **UI**: Custom minimalist components (no heavy UI library)

### **Backend**
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (staff roles)
- **Real-time**: Supabase Realtime (WebSocket subscriptions)
- **Functions**: Supabase Edge Functions (M-Pesa integration)

### **Payment**
- **Provider**: Safaricom M-Pesa Daraja API
- **Method**: STK Push (customer receives payment prompt on phone)
- **Flow**: Edge Function → Daraja API → Callback → Database update

---

## **Detailed Module Breakdown**

### **1. Table Management**
**Purpose**: Visual dashboard of restaurant seating status

**Features**:
- Grid view of all tables (2-column layout for mobile)
- Real-time status updates across all devices
- Color-coded status badges:
  - **Green** (Available): Ready for new guests
  - **Orange** (Occupied): Active order in progress
  - **Blue** (Awaiting Payment): Payment request sent

**User Actions**:
- Tap available table → Create new order
- Tap occupied table → Continue existing order
- Status auto-updates via database triggers (no manual changes)

**Technical Details**:
- Supabase Realtime subscription on `tables` table
- Database triggers automatically update status based on order/payment state
- Optimistic UI updates for instant feedback

---

### **2. Order Management**
**Purpose**: Fast, error-free order entry and tracking

**Features**:
- Add items from menu (searchable/filterable)
- Quantity controls (+/− buttons, large touch targets)
- Remove items with confirmation
- Real-time total calculation
- Price snapshot system (orders immune to menu price changes)
- Split view: Items list + Running total

**Data Flow**:
```
Menu Item (current price) 
  → Order Item (price_snapshot) 
  → Quantity × Price Snapshot = Subtotal 
  → Sum(Subtotals) = Order Total
```

**User Actions**:
- Tap menu item → Instantly added to order (quantity: 1)
- Adjust quantities → Subtotal/total updates immediately
- Remove item → Confirmation alert → Deleted

**Edge Cases Handled**:
- Menu item deleted after order created → Order keeps `menu_item_name` + `price_snapshot`
- Concurrent edits by multiple staff → Last write wins (acceptable for POS)
- Empty orders → Can't proceed to payment

---

### **3. Menu Management**
**Purpose**: Product catalog with availability toggle

**Features**:
- List/grid view of all menu items
- Fields: Name, Price, Category (optional), Availability toggle
- Filter by category (e.g., "Drinks", "Mains", "Desserts")
- Admin-only CRUD operations (via role check)

**User Actions** (Admin only):
- Add new item → Form: Name, Price, Category, Available (default: true)
- Edit item → Update price/availability
- Toggle availability → Hides from staff order screen (soft delete)
- Delete item → Confirmation → Permanent removal

**Staff View**:
- See only available items when adding to orders
- Quick category filters for faster navigation

---

### **4. Payment System (M-Pesa STK Push)**
**Purpose**: Cashless, instant payment processing

**Technical Flow**:
```
1. Staff enters customer phone (07XXXXXXXX or 2547XXXXXXXX)
2. App calls Supabase Edge Function with:
   - phone_number
   - amount (order total)
   - order_id
3. Edge Function:
   - Gets OAuth token from Daraja API
   - Sends STK Push request
   - Stores payment record (status: pending)
   - Returns checkout_request_id
4. Customer receives M-Pesa prompt on phone
5. Customer enters PIN
6. Daraja sends callback to Edge Function callback URL
7. Edge Function updates payment record:
   - status: success/failed
   - mpesa_receipt_number (if success)
8. Database trigger updates:
   - Order status: open → paid
   - Table status: awaiting_payment → available
9. App shows success/failure message via Realtime subscription
```

**UI States**:
- **Initial**: Phone input + "Send Payment Request" button
- **Waiting**: Loading spinner + "Waiting for customer to confirm..."
- **Success**: Green checkmark + receipt number + "Done" button
- **Failed**: Red X + error message + "Retry" button
- **Timeout**: After 60s, show "Payment timed out, please retry"

**Edge Cases**:
- Customer cancels prompt → Payment stays `pending` (manual void needed)
- Network failure mid-request → Retry mechanism with exponential backoff
- Duplicate requests → Use `checkout_request_id` as idempotency key
- Wrong phone number → Clear validation (must start with 07 or 2547)

---

### **5. Reservations System**
**Purpose**: Simple booking management (no complex scheduling)

**Features**:
- Create reservation: Name, Phone, Date/Time, Table assignment
- Status workflow:
  - **Pending**: Reservation created, guest hasn't arrived
  - **Seated**: Guest arrived, table marked occupied (auto-trigger)
  - **Completed**: Guest finished, table released

**User Actions**:
- View list of upcoming reservations (sorted by time)
- Tap "Seat Guest" → Status: pending → seated, Table: available → occupied
- After payment → Reservation: seated → completed (auto or manual)

**UI**:
- Simple list view (no calendar widget for speed)
- Color-coded status badges
- Quick filters: Today | Upcoming | Completed

**Optional Enhancements** (if time permits):
- SMS reminder via Africa's Talking API
- No-show handling (auto-cancel after 15min)

---

### **6. Staff Authentication & Roles**
**Purpose**: Secure access with role-based permissions

**Roles**:
1. **Staff**: Can view/edit orders, tables, request payments
2. **Admin**: All staff permissions + menu management + analytics

**Implementation**:
- Supabase Auth (email/password or magic link)
- `staff_profiles` table with role field
- Row Level Security (RLS) policies enforce permissions
- Login screen → Session persists in AsyncStorage

**Permissions Matrix**:
| Feature | Staff | Admin |
|---------|-------|-------|
| View tables | ✅ | ✅ |
| Create/edit orders | ✅ | ✅ |
| Request payments | ✅ | ✅ |
| Add/edit menu items | ❌ | ✅ |
| View analytics | ❌ | ✅ |
| Manage staff accounts | ❌ | ✅ |

---

### **7. Analytics Dashboard** (Bonus Module)
**Purpose**: Quick business insights without complex BI tools

**Metrics**:
- **Today's Revenue**: Sum of successful payments today
- **Orders Completed**: Count of paid orders today
- **Payment Status Breakdown**: Pie chart (success/pending/failed)
- **Top Items**: Most ordered menu items (last 7 days)
- **Table Utilization**: % time each table is occupied

**UI**:
- Simple card-based layout
- Minimal charts (use `react-native-chart-kit` or Recharts)
- Date range picker (Today | This Week | This Month)
- Export to CSV (optional)

**Performance**:
- Pre-aggregated views in database (materialized view or daily cron)
- No real-time updates (refresh on screen focus)

---

## **Database Schema** (PostgreSQL)

### **Tables**
```
tables
├── id (uuid, PK)
├── name (text) - "Table 1", "VIP Table"
├── status (enum) - available | occupied | awaiting_payment
└── created_at (timestamptz)

menu_items
├── id (uuid, PK)
├── name (text)
├── price (decimal)
├── category (text, nullable)
├── available (boolean)
└── created_at (timestamptz)

orders
├── id (uuid, PK)
├── table_id (uuid, FK → tables.id)
├── status (enum) - open | paid
├── total (decimal, auto-calculated)
├── created_at (timestamptz)
└── updated_at (timestamptz)

order_items
├── id (uuid, PK)
├── order_id (uuid, FK → orders.id)
├── menu_item_id (uuid, FK → menu_items.id)
├── menu_item_name (text) - Snapshot for history
├── price_snapshot (decimal) - Price at time of order
├── quantity (integer)
└── subtotal (decimal, generated column)

payments
├── id (uuid, PK)
├── order_id (uuid, FK → orders.id)
├── phone_number (text)
├── amount (decimal)
├── mpesa_receipt_number (text, nullable)
├── status (enum) - pending | success | failed
└── created_at (timestamptz)

reservations
├── id (uuid, PK)
├── customer_name (text)
├── phone_number (text)
├── table_id (uuid, FK → tables.id)
├── reservation_time (timestamptz)
├── status (enum) - pending | seated | completed
└── created_at (timestamptz)

staff_profiles
├── id (uuid, PK, FK → auth.users.id)
├── role (enum) - staff | admin
└── created_at (timestamptz)
```

### **Key Database Triggers**
1. **Auto-update table status on order creation**
2. **Auto-update table status on payment request**
3. **Auto-update table status on payment success**
4. **Auto-calculate order total when order_items change**
5. **Auto-mark reservation completed when order paid**

---

## **Performance Optimizations**

1. **Database Indexes**:
   - `orders(table_id, status)` - Fast order lookups
   - `order_items(order_id)` - Fast item retrieval
   - `payments(order_id, status)` - Payment tracking
   - `reservations(reservation_time, status)` - Upcoming bookings

2. **Caching Strategy**:
   - Menu items cached locally (refresh on app start)
   - Tables use Supabase Realtime (no polling)
   - Payment status polling (3s interval, max 60s)

3. **Network Efficiency**:
   - Batch order item updates (debounced quantity changes)
   - Optimistic UI updates (instant feedback)
   - Minimal payload sizes (select only needed fields)

4. **UI Responsiveness**:
   - Large touch targets (min 44×44pt)
   - Haptic feedback on critical actions
   - Skeleton loaders during data fetch
   - Pull-to-refresh on all list screens

---

## **Security Measures**

1. **Authentication**:
   - JWT-based sessions (Supabase handles rotation)
   - Secure token storage (AsyncStorage with encryption)
   - Auto-logout after 24h inactivity

2. **Authorization**:
   - Row Level Security (RLS) on all tables
   - Role-based access control via `staff_profiles`
   - Admin actions require role check

3. **Payment Security**:
   - M-Pesa credentials stored in Edge Function environment variables
   - No sensitive data in client-side code
   - Callback URL validation (Safaricom IP whitelist)
   - Idempotent payment requests (prevent duplicate charges)

4. **Data Protection**:
   - HTTPS only (no plain HTTP)
   - Input sanitization (SQL injection prevention)
   - Rate limiting on Edge Functions (prevent abuse)

---

## **Deployment Strategy**

### **Mobile App**
- **Development**: Expo Go (instant testing)
- **Staging**: Expo EAS Build (internal distribution)
- **Production**: App Store + Google Play Store

### **Backend**
- **Database**: Supabase (managed PostgreSQL)
- **Edge Functions**: Deployed via Supabase CLI
- **Environment**: Staging + Production projects

### **CI/CD**
- GitHub Actions for automated builds
- Expo EAS for OTA updates (bug fixes without app store review)
- Database migrations via Supabase Migrations

---

## **Future Enhancements** (Out of MVP Scope)

1. **Kitchen Display System (KDS)**: Orders sent to kitchen screen
2. **Receipt Printing**: Bluetooth printer integration
3. **Multi-location**: Support restaurant chains
4. **Inventory Management**: Track stock levels
5. **Customer Loyalty**: Points/rewards system
6. **Table Splitting**: Split bills between multiple payments
7. **Tipping**: Add tip amount to payment
8. **Offline Mode**: Queue actions when offline, sync when back online

---

## **Success Metrics**

1. **Speed**: Order entry < 30 seconds per table
2. **Reliability**: 99.5% payment success rate
3. **Uptime**: 99.9% app availability
4. **User Satisfaction**: Staff can use with < 5min training
5. **Performance**: < 2s screen load times

---

## **Technology Justification**

**Why React Native + Expo?**
- Single codebase for iOS/Android
- Fast iteration (hot reload)
- Rich ecosystem (payment libs, charts, etc.)

**Why Supabase?**
- Built-in real-time (no custom WebSocket server)
- PostgreSQL (robust, SQL queries)
- Edge Functions (serverless, scales automatically)
- Authentication included

**Why M-Pesa STK Push?**
- 90%+ smartphone penetration in Kenya
- Instant payment confirmation
- No card processing fees
- Customer trust (familiar interface)

---

**This is K19POS**: A lean, fast, real-time restaurant management system built for Kenyan restaurants embracing digital payments.