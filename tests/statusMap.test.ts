import { mapGuestStatusToBadge } from '@/lib/statusMap';

describe('mapGuestStatusToBadge', () => {
  it('maps known guest statuses to badge keys (positive)', () => {
    expect(mapGuestStatusToBadge('pending')).toBe('pending');
    expect(mapGuestStatusToBadge('ordered')).toBe('open');
    expect(mapGuestStatusToBadge('served')).toBe('seated');
    expect(mapGuestStatusToBadge('pending_payment')).toBe('awaiting_payment');
    expect(mapGuestStatusToBadge('paid')).toBe('paid');
  });

  it('returns pending for unknown status (negative/edge)', () => {
    // @ts-ignore - simulate unexpected value
    expect(mapGuestStatusToBadge('unknown_status')).toBe('pending');
  });
});
