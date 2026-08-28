import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPortalAccess, RELATIONSHIP_LABELS } from '@/features/portals/access';

export const metadata: Metadata = { title: 'Mijn vervoer' };

export default async function PortalHomePage() {
  const access = await getPortalAccess();

  // With a single linked client the list is a pointless extra tap, so go
  // straight in. That is the common case for a parent with one child.
  if (access.clients.length === 1) {
    const only = access.clients[0]!;
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={`/portaal/${only.id}` as never}
          className="flex items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4"
        >
          <span className="flex-1">
            <span className="block font-medium">
              {only.firstName} {only.lastName}
            </span>
            <span className="text-sm text-[var(--tp-muted-foreground)]">
              {only.relationLabel ?? RELATIONSHIP_LABELS[only.relationships[0]!]}
            </span>
          </span>
          <ChevronRight className="size-5 opacity-40" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Mijn vervoer</h1>
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        {access.clients.length} personen waarvan je het vervoer kunt volgen.
      </p>

      <ul className="flex flex-col gap-2">
        {access.clients.map((client) => (
          <li key={client.id}>
            <Link
              href={`/portaal/${client.id}` as never}
              className="flex items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {client.firstName} {client.lastName}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {client.relationLabel ? (
                    <Badge variant="info">{client.relationLabel}</Badge>
                  ) : null}
                  {client.relationships.map((relationship) => (
                    <Badge key={relationship} variant="outline">
                      {RELATIONSHIP_LABELS[relationship]}
                    </Badge>
                  ))}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 opacity-40" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
