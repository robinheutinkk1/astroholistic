import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type PickerOption } from './components/ride-form';

/**
 * The dropdown contents for the ride form.
 *
 * One round trip for all four lists. Each is bounded by RLS, so a planner can
 * only ever pick from their own organisation.
 */
export async function loadPickerOptions(organizationId: string): Promise<{
  clients: PickerOption[];
  locations: PickerOption[];
  drivers: PickerOption[];
  vehicles: PickerOption[];
}> {
  const supabase = await createClient();

  const [clients, locations, drivers, vehicles] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('last_name'),
    supabase
      .from('locations')
      .select('id, name, city')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('last_name'),
    supabase
      .from('vehicles')
      .select('id, license_plate, make, model')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('license_plate'),
  ]);

  return {
    clients: (clients.data ?? []).map((c) => ({
      id: c.id,
      label: `${c.last_name}, ${c.first_name}`,
    })),
    locations: (locations.data ?? []).map((l) => ({
      id: l.id,
      label: l.city ? `${l.name} (${l.city})` : l.name,
    })),
    drivers: (drivers.data ?? []).map((d) => ({
      id: d.id,
      label: `${d.first_name} ${d.last_name}`,
    })),
    vehicles: (vehicles.data ?? []).map((v) => ({
      id: v.id,
      label: [v.license_plate, v.make, v.model].filter(Boolean).join(' · '),
    })),
  };
}
