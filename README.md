# K19 POS - Restaurant Point of Sale System 🍽️

A modern, **local-first** point-of-sale system built with React Native (Expo) and Supabase, designed for restaurants with table management, menu control, reservations, order tracking, and **M-Pesa payment integration**.

## ⚡ Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd k19pos
npm install

# 2. Set up .env with Supabase and Lipana keys
cp .env.example .env
# Edit .env with your credentials

# 3. Start development server
npx expo start

# 4. Scan QR code with Expo Go on your phone
# Or: press 'a' for Android / 'i' for iOS emulator
```

**First-time setup?** See the detailed [Getting Started](#-getting-started) section below.

## 🌟 Key Features

### Local-First Architecture
- **Offline-first design** - Works completely offline with local SQLite database
- **Automatic sync** - Syncs with Supabase when connection is available
- **Network resilience** - No data loss during connectivity issues
- **Real-time updates** - Changes sync automatically in the background

### Core Functionality
- **Table Management** - Visual table cards with status tracking (available, occupied, reserved)
- **Menu Management** - Daily menu creation with starters, main meals (3-component system), desserts, and drinks
- **Reservations** - Guest booking system with time slots
- **Order Processing** - Track orders by table with real-time status updates
- **User Management** - Role-based access control (admin, manager, chef, staff)

### Payment Integration 💳
- **M-Pesa Payments** - Real-time STK Push payments via Lipana API
- **Guest-level Payments** - Each guest pays their own bill independently
- **Automatic Status Tracking** - Guest status updates (pending → pending_payment → paid)
- **Webhook Processing** - Real-time payment confirmation and webhook callbacks
- **Table Availability** - Automatic table availability when all guests are paid
- **Transaction Audit** - Full payment transaction history and audit trail

### Menu System
- **Service Date Tracking** - Menus tied to specific dates
- **Multi-option Main Meals** - Each main meal has meat, carbohydrate, and vegetable components
- **Price Management** - Total meal price stored on meat component (carb/veg = 0)
- **Quick Create** - One-tap default menu creation
- **Custom Creation** - Full control over menu items and prices
- **Edit Support** - Tap cards to edit names and prices

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd k19pos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Lipana Payment Configuration
   EXPO_PUBLIC_LIPANA_SECRET_KEY=your_lipana_secret_key
   EXPO_PUBLIC_LIPANA_PUBLISHABLE_KEY=your_lipana_publishable_key
   EXPO_PUBLIC_LIPANA_WEBHOOK_SECRET=your_webhook_secret
   EXPO_PUBLIC_LIPANA_ENVIRONMENT=production
   ```

4. **Set up Supabase database**
   
   Run the following SQL in your Supabase SQL editor:
   ```sql
   -- Tables
   CREATE TABLE tables (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     table_number INTEGER NOT NULL UNIQUE,
     seats INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'available',
     current_order_id UUID,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Menu Items
   CREATE TABLE menu_items (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     subcategory TEXT,
     meal_option TEXT,
     price DECIMAL NOT NULL,
     available BOOLEAN DEFAULT true,
     created_by UUID REFERENCES auth.users(id),
     service_date DATE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Staff Profiles
   CREATE TABLE staff_profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     name TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'staff',
     phone TEXT,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Reservations
   CREATE TABLE reservations (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
     guest_name TEXT NOT NULL,
     guest_count INTEGER NOT NULL,
     reservation_time TIMESTAMP WITH TIME ZONE NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Orders
   CREATE TABLE orders (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     table_id UUID REFERENCES tables(id),
     status TEXT NOT NULL DEFAULT 'pending',
     total DECIMAL DEFAULT 0,
     created_by UUID REFERENCES auth.users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Order Items
   CREATE TABLE order_items (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
     menu_item_id UUID REFERENCES menu_items(id),
     quantity INTEGER NOT NULL,
     price DECIMAL NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

5. **Start the development server**
   ```bash
   npx expo start
   ```

6. **Run on your device**
   - Scan the QR code with Expo Go app (Android/iOS)
   - Or press `a` for Android emulator
   - Or press `i` for iOS simulator

## 💳 Payment Integration

### Lipana M-Pesa Setup

This system uses [Lipana](https://lipana.dev) for M-Pesa STK Push payments.

**Get your keys:**
1. Create account at https://dashboard.lipana.dev
2. Get your **Secret Key** and **Publishable Key**
3. Configure webhook URL: `https://your-domain.com/lipana-webhook`
4. Get webhook secret from settings

**Testing:**
- Use sandbox/test keys for development (no real charges)
- Switch to production keys for live payments
- See `PRODUCTION_MODE.md` for testing guide

### Payment Flow

```
Guest Orders → Table View → Process Payment
     ↓              ↓              ↓
Guest selects items → Enter M-Pesa number → STK Push
                                   ↓
                        Customer enters PIN
                                   ↓
                        Payment processes (real money)
                                   ↓
                        Webhook updates status
                                   ↓
Guest Status: Paid ✅ → Table: Available ✅
```

### Guest Payment Status

- **pending** - Guest added, no payment initiated
- **pending_payment** - Payment initiated, waiting for completion
- **paid** - Payment successful, guest bill settled
- **reserved** - Guest has a reservation

### Testing Payments

For development/testing documentation, see:
- `PRODUCTION_MODE.md` - Complete testing guide with real M-Pesa
- `PAYMENT_INTEGRATION_STATUS.md` - Integration status and known issues
- `STK_PUSH_DEBUGGING.md` - Troubleshooting guide

## 📱 App Structure

```
k19pos/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   │   └── login.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── index.tsx      # Tables screen
│   │   ├── menu.tsx       # Menu list screen
│   │   ├── reservations.tsx
│   │   └── _layout.tsx
│   ├── order/             # Order management
│   │   └── [id].tsx
│   └── payment/           # Payment processing
│       └── [orderId].tsx
├── components/            # Reusable components
├── context/              # React Context (Auth)
├── hooks/                # Custom React hooks
├── lib/                  # Core libraries
│   ├── supabase.ts       # Supabase client
│   ├── lipana.ts         # Lipana payment client
│   ├── localDb.ts        # SQLite database setup
│   ├── syncManager.ts    # Offline sync logic
│   ├── localDataAccess.ts # Local data operations
│   └── types.ts          # TypeScript types
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge functions (webhooks)
│       ├── lipana-webhook/
│       └── lipana-webhook-test/
├── constants/            # App constants
└── README.md             # This file
```

## 🔄 Local-First Sync Architecture

### How It Works

1. **All operations write to local SQLite first** - Instant response, no waiting for network
2. **Changes are queued** - Every insert/update/delete goes into a sync queue
3. **Background sync** - Automatically syncs with Supabase when online
4. **Network monitoring** - Detects connectivity changes and triggers sync
5. **Conflict resolution** - Last-write-wins strategy (customizable)

### Key Files

- `lib/localDb.ts` - Local SQLite database initialization
- `lib/syncManager.ts` - Network monitoring and sync orchestration
- `lib/localDataAccess.ts` - Local CRUD operations with queue management

### Sync Flow

```
User Action → Local SQLite → Sync Queue → Background Sync → Supabase
              ↓ (instant)                    ↓ (when online)
              UI Update                      Remote Persistence
```

## 👥 User Roles

- **Admin** - Full system access, user management
- **Manager** - Menu and staff management, reporting
- **Chef** - View menus, update order status
- **Staff** - Table management, order taking, basic operations

## 🎨 Design Philosophy

- **Mobile-first** - Optimized for tablets and phones
- **Offline-capable** - Works without internet connection
- **Fast & responsive** - Local-first = instant UI updates
- **Role-based** - Different views for different staff roles
- **Easy to use** - Intuitive card-based interface

## 🛠️ Tech Stack

- **Frontend**: React Native (Expo SDK 54)
- **Navigation**: Expo Router (file-based routing)
- **Database**: Supabase (PostgreSQL) + SQLite (local)
- **Authentication**: Supabase Auth
- **Payments**: Lipana M-Pesa STK Push API
- **Offline Sync**: Custom sync engine with expo-sqlite
- **Network Detection**: @react-native-community/netinfo
- **UI**: React Native components with custom styling

## 📦 Key Dependencies

```json
{
  "expo": "~54.0.27",
  "expo-router": "~6.0.17",
  "expo-sqlite": "latest",
  "@supabase/supabase-js": "^2.x",
  "@react-native-community/netinfo": "latest",
  "react-native-calendars": "latest",
  "uuid": "latest"
}
```

## 🔐 Security Notes

### Payment Security
- Payment webhook signature verification enabled
- All transaction data encrypted in transit
- Row Level Security (RLS) enforced on payments table
- Transaction IDs stored securely with audit trail
- Webhook secret kept in server-side environment variables

### General Security
- Never commit `.env` file to version control
- Use Row Level Security (RLS) policies in Supabase
- Implement proper authentication checks
- Validate user roles on both client and server
- Keep webhook secrets private (stored in `supabase/functions/.env`)

## 📝 Development Notes

### Menu Price Structure
- Main meals have 3 components: meat, carb, vegetable
- Total price stored ONLY on meat component
- Carb and veg components have price = 0
- This prevents triple-counting the price

### Date Handling
- Service dates are locked when editing existing menus
- To change a menu's date, create a new menu
- All menus are user-scoped (created_by field)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test offline functionality
5. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for restaurant efficiency
