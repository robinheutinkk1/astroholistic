import { type Tables } from '@/types/database';

/**
 * View models for rides.
 *
 * Kept out of repository.ts so components can import the type without
 * importing the data layer — which the architecture lint rule forbids, and
 * rightly so: a component that can reach the repository will eventually call it.
 */
export interface RideListItem {
  readonly id: string;
  readonly scheduled_date: string;
  readonly scheduled_pickup_time: string;
  readonly scheduled_pickup_at: string;
  readonly status: Tables<'rides'>['status'];
  readonly is_modified: boolean;
  readonly transport_requirements: Tables<'rides'>['transport_requirements'];
  readonly driver_id: string | null;
  readonly vehicle_id: string | null;
  readonly trip_id: string | null;
  readonly client: { first_name: string; last_name: string } | null;
  readonly pickup: { name: string; city: string | null } | null;
  readonly destination: { name: string; city: string | null } | null;
  readonly driver: { first_name: string; last_name: string } | null;
  readonly vehicle: { license_plate: string } | null;
}
