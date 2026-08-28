import { Badge, type BadgeProps } from '@/components/ui/badge';
import { RIDE_STATUS_LABELS, type RideStatus } from '../status';

/**
 * Status colours are fixed platform-wide, not tenant-configurable: a dispatcher
 * who works for two organisations must not have to relearn what red means
 * (docs/ARCHITECTURE.md §11).
 */
const STATUS_VARIANT: Record<RideStatus, NonNullable<BadgeProps['variant']>> = {
  SCHEDULED: 'neutral',
  DRIVER_ASSIGNED: 'info',
  DRIVER_EN_ROUTE: 'info',
  DRIVER_ARRIVED: 'info',
  CLIENT_CHECKED_IN: 'success',
  TRIP_STARTED: 'info',
  ARRIVED: 'success',
  COMPLETED: 'success',
  CLIENT_ABSENT: 'warning',
  CANCELLED: 'outline',
  PROBLEM: 'danger',
};

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {/* A coloured dot alone would fail for colour-blind users (§48), so the
          label is always present rather than tooltip-only. */}
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {RIDE_STATUS_LABELS[status]}
    </Badge>
  );
}
