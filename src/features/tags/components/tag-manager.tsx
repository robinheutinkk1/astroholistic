'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Copy, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { qrSvg } from '../qr';
import {
  assignTagAction,
  createTagAction,
  setTagStatusAction,
  unassignTagAction,
  type CreateTagState,
} from '../actions';
import type { TagListItem } from '../service';

const STATUS_LABELS: Record<TagListItem['status'], string> = {
  UNASSIGNED: 'Niet gekoppeld',
  ACTIVE: 'Actief',
  INACTIVE: 'Uitgeschakeld',
  LOST: 'Verloren',
  REPLACED: 'Vervangen',
};

const STATUS_TONE: Record<
  TagListItem['status'],
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  UNASSIGNED: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  LOST: 'danger',
  REPLACED: 'warning',
};

function SmallButton({
  label,
  variant,
}: {
  label: string;
  variant?: 'outline' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant ?? 'outline'} loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Shown once, immediately after creating a tag.
 *
 * The token is never stored — only its hash — so this is the only moment it can
 * be written to a physical tag or printed. Saying so plainly is the difference
 * between a planner writing it down and a tag that has to be thrown away.
 */
function NewTagPanel({
  created,
  appUrl,
}: {
  created: NonNullable<CreateTagState['created']>;
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${appUrl}/t/${created.token}`;

  /*
   * De QR wordt hier in de browser gemaakt en niet door een route op de server
   * opgehaald. Dat kan ook niet anders: van de tag bewaren we alleen een
   * versleutelde afdruk, dus de server kan deze link nooit opnieuw opbouwen.
   *
   * Er stond eerder een link naar `/tags/{id}/qr`. Die pagina bestond niet — en
   * had ook niet kunnen bestaan. Bovendien zou de code dan in de URL staan, en
   * daarmee in de geschiedenis van de browser en in de logboeken van elke
   * tussenliggende server. Precies wat een geheim niet moet overkomen.
   */
  const qrDataUri = useMemo(
    () => `data:image/svg+xml;base64,${btoa(qrSvg(url, 160))}`,
    [url],
  );

  return (
    <div className="flex flex-col gap-3 rounded-[var(--tp-radius)] border-2 border-[var(--tp-primary)] bg-[var(--tp-surface)] p-4">
      <div>
        <p className="text-sm font-medium">Tag aangemaakt: {created.publicCode}</p>
        <p className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
          Schrijf deze link nu naar de NFC-tag, of print de QR-code. Na het sluiten van
          dit vak is de code <strong>niet meer op te vragen</strong>. We bewaren hem niet,
          alleen een versleutelde afdruk. Ben je hem kwijt, dan maak je een nieuwe tag
          aan.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="font-mono text-xs" aria-label="Tag-link" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          <Copy aria-hidden="true" />
          {copied ? 'Gekopieerd' : 'Kopiëren'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- een data-URI die
            hier ter plekke is opgebouwd; next/image is voor bestanden op een
            server en zou hier alleen een omweg zijn. */}
        <img
          src={qrDataUri}
          alt={`QR-code voor tag ${created.publicCode}`}
          width={160}
          height={160}
          className="rounded border border-[var(--tp-border)] bg-white"
        />
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-[var(--tp-muted-foreground)]">
            Dezelfde link als op de NFC-tag, voor wie een telefoon zonder NFC heeft.
          </p>
          <a
            href={qrDataUri}
            download={`tag-${created.publicCode}.svg`}
            className="font-medium text-[var(--tp-primary)] underline underline-offset-4"
          >
            QR-code downloaden om te printen
          </a>
        </div>
      </div>
    </div>
  );
}

export function TagManager({
  tags,
  clients,
  canManage,
  appUrl,
}: {
  tags: readonly TagListItem[];
  clients: readonly { id: string; label: string }[];
  canManage: boolean;
  appUrl: string;
}) {
  const [createState, createAction] = useActionState<CreateTagState, FormData>(
    createTagAction,
    IDLE,
  );
  const [assignState, assignAction] = useActionState<FormState, FormData>(
    assignTagAction,
    IDLE,
  );
  const [statusState, statusAction] = useActionState<FormState, FormData>(
    setTagStatusAction,
    IDLE,
  );
  const [unassignState, unassignAction] = useActionState<FormState, FormData>(
    unassignTagAction,
    IDLE,
  );

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <form action={createAction} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label htmlFor="label" className="mb-1 block text-sm font-medium">
              Nieuwe tag
            </label>
            <Input
              id="label"
              name="label"
              placeholder="Omschrijving, bijvoorbeeld: doosje 1, tag 3"
            />
          </div>
          <Button type="submit">
            <Plus aria-hidden="true" />
            Tag aanmaken
          </Button>
        </form>
      ) : null}

      {createState.created ? (
        <NewTagPanel created={createState.created} appUrl={appUrl} />
      ) : (
        <FormStatus state={createState} />
      )}
      <FormStatus state={assignState} />
      <FormStatus state={statusState} />
      <FormStatus state={unassignState} />

      {tags.length === 0 ? (
        <EmptyState
          title="Nog geen tags"
          description="Maak een tag aan, schrijf hem naar een NFC-sticker en koppel hem aan een cliënt."
        />
      ) : (
        <Table caption="NFC- en QR-tags">
          <Thead>
            <Th>Code</Th>
            <Th>Cliënt</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Acties</span>
            </Th>
          </Thead>
          <Tbody>
            {tags.map((tag) => (
              <Tr key={tag.id}>
                <Td>
                  <span className="font-mono font-medium">{tag.public_code}</span>
                  {tag.label ? (
                    <span className="block text-xs text-[var(--tp-muted-foreground)]">
                      {tag.label}
                    </span>
                  ) : null}
                </Td>

                <Td>
                  {tag.client ? (
                    <span>
                      {tag.client.first_name} {tag.client.last_name}
                    </span>
                  ) : canManage && tag.status !== 'LOST' && tag.status !== 'REPLACED' ? (
                    <form
                      action={assignAction}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <input type="hidden" name="tagId" value={tag.id} />
                      <Select
                        name="clientId"
                        aria-label="Koppelen aan cliënt"
                        className="h-8 w-48 text-xs"
                        options={[
                          { value: '', label: 'Kies een cliënt' },
                          ...clients.map((c) => ({ value: c.id, label: c.label })),
                        ]}
                      />
                      <SmallButton label="Koppelen" />
                    </form>
                  ) : (
                    <span className="text-sm text-[var(--tp-muted-foreground)]">-</span>
                  )}
                </Td>

                <Td>
                  <Badge variant={STATUS_TONE[tag.status]}>
                    {STATUS_LABELS[tag.status]}
                  </Badge>
                </Td>

                <Td>
                  {canManage ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tag.client ? (
                        <form action={unassignAction}>
                          <input type="hidden" name="tagId" value={tag.id} />
                          <SmallButton label="Loskoppelen" />
                        </form>
                      ) : null}

                      {tag.status === 'ACTIVE' ? (
                        <form action={statusAction}>
                          <input type="hidden" name="tagId" value={tag.id} />
                          <input type="hidden" name="status" value="INACTIVE" />
                          <SmallButton label="Uitschakelen" />
                        </form>
                      ) : null}

                      {tag.status === 'INACTIVE' && tag.client ? (
                        <form action={statusAction}>
                          <input type="hidden" name="tagId" value={tag.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <SmallButton label="Aanzetten" />
                        </form>
                      ) : null}

                      {tag.status !== 'LOST' && tag.status !== 'REPLACED' ? (
                        <form action={statusAction}>
                          <input type="hidden" name="tagId" value={tag.id} />
                          <input type="hidden" name="status" value="LOST" />
                          <SmallButton label="Kwijt" variant="danger" />
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
