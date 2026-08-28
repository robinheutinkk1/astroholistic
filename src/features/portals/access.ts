import 'server-only';
import { cache } from 'react';
import { requireUser } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Who is looking at the portal, and what may they do.
 *
 * ONE PORTAL, NOT THREE. The masterprompt describes a client portal (§31), a
 * parent portal (§32) and a care-organisation portal (§33). Functionally they
 * are the same screen: "the clients I may see, their rides, and the few things
 * I may do". Only the capabilities differ, and those already live on the
 * relationship rows.
 *
 * Three near-identical screens would mean three places to fix a bug and three
 * chances for one of them to leak. The relationship decides what appears; the
 * screen adapts.
 *
 * A user can hold several relationships at once — a parent who is also a client
 * of the same organisation — and this returns all of them.
 */
export type PortalRelationship = 'CLIENT' | 'CONTACT' | 'CARE_ORG';

export interface PortalClient {
  readonly id: string;
  readonly organizationId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly city: string | null;
  /** How this viewer reaches the client. Several can apply at once. */
  readonly relationships: readonly PortalRelationship[];
  /** Human label, e.g. "moeder" — only meaningful for a contact link. */
  readonly relationLabel: string | null;
  readonly canReportAbsence: boolean;
  readonly canRequestChanges: boolean;
}

export interface PortalAccess {
  readonly userId: string;
  readonly clients: readonly PortalClient[];
}

/**
 * Resolves portal access from the relationship tables.
 *
 * Reads are still filtered by RLS afterwards; this exists so the screen knows
 * which buttons to show, not to decide what may be read.
 */
export const getPortalAccess = cache(async (): Promise<PortalAccess> => {
  const user = await requireUser();
  const supabase = await createClient();

  const [selfResult, contactResult, careResult] = await Promise.all([
    // The client's own account.
    supabase
      .from('clients')
      .select('id, organization_id, first_name, last_name, city')
      .eq('user_id', user.id)
      .is('deleted_at', null),

    // Linked contacts, with the per-link capability flags.
    supabase.from('client_contacts').select(
      `relationship, can_view_rides, can_report_absence, can_request_changes,
         client:clients!client_contacts_client_id_fkey
           (id, organization_id, first_name, last_name, city, deleted_at),
         contact:contacts!client_contacts_contact_id_fkey (user_id)`,
    ),

    // Clients funded by a care organisation the user belongs to. The validity
    // window is enforced by RLS; this only reads what it returns.
    supabase.from('client_care_organizations').select(
      `client:clients!client_care_organizations_client_id_fkey
           (id, organization_id, first_name, last_name, city, deleted_at)`,
    ),
  ]);

  const byId = new Map<string, PortalClient>();

  const add = (
    row: {
      id: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      city: string | null;
    },
    relationship: PortalRelationship,
    capabilities: {
      relationLabel?: string | null;
      canReportAbsence?: boolean;
      canRequestChanges?: boolean;
    } = {},
  ) => {
    const existing = byId.get(row.id);
    byId.set(row.id, {
      id: row.id,
      organizationId: row.organization_id,
      firstName: row.first_name,
      lastName: row.last_name,
      city: row.city,
      relationships: [...new Set([...(existing?.relationships ?? []), relationship])],
      relationLabel: capabilities.relationLabel ?? existing?.relationLabel ?? null,
      // Capabilities accumulate: someone who is both the client and a listed
      // contact gets the union, not whichever row happened to load last.
      canReportAbsence:
        (existing?.canReportAbsence ?? false) || (capabilities.canReportAbsence ?? false),
      canRequestChanges:
        (existing?.canRequestChanges ?? false) ||
        (capabilities.canRequestChanges ?? false),
    });
  };

  for (const row of selfResult.data ?? []) {
    // A client acting for themselves may always ask; a planner still reviews.
    add(row, 'CLIENT', { canReportAbsence: true, canRequestChanges: true });
  }

  for (const row of contactResult.data ?? []) {
    const client = row.client as unknown as {
      id: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      city: string | null;
      deleted_at: string | null;
    } | null;
    const contact = row.contact as unknown as { user_id: string | null } | null;

    // RLS returns links a staff member may also see, so restrict to this user's
    // own contact record.
    if (!client || client.deleted_at || contact?.user_id !== user.id) continue;
    if (!row.can_view_rides) continue;

    add(client, 'CONTACT', {
      relationLabel: row.relationship,
      canReportAbsence: row.can_report_absence,
      canRequestChanges: row.can_request_changes,
    });
  }

  for (const row of careResult.data ?? []) {
    const client = row.client as unknown as {
      id: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      city: string | null;
      deleted_at: string | null;
    } | null;
    if (!client || client.deleted_at) continue;

    // A funder follows the transport but does not speak for the client, so no
    // absence reporting and no change requests.
    add(client, 'CARE_ORG');
  }

  return {
    userId: user.id,
    clients: [...byId.values()].sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    ),
  };
});

export async function getPortalClient(clientId: string): Promise<PortalClient | null> {
  const access = await getPortalAccess();
  return access.clients.find((client) => client.id === clientId) ?? null;
}

export const RELATIONSHIP_LABELS: Record<PortalRelationship, string> = {
  CLIENT: 'Jouw eigen ritten',
  CONTACT: 'Contactpersoon',
  CARE_ORG: 'Via je organisatie',
};
