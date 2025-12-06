import { GuestStatus } from './types';

export function mapGuestStatusToBadge(status: GuestStatus) {
  switch (status) {
    case 'pending': return 'pending';
    case 'ordered': return 'open';
    case 'served': return 'seated';
    case 'cleared': return 'completed';
    case 'pending_payment': return 'awaiting_payment';
    case 'paid': return 'paid';
    default: return 'pending';
  }
}

export type BadgeKey = ReturnType<typeof mapGuestStatusToBadge>;
