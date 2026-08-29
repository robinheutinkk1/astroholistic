'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import {
  addDomainAction,
  makePrimaryDomainAction,
  removeDomainAction,
  verifyDomainAction,
} from '../actions';
import { verificationRecordName, verificationRecordValue } from '../hostname';
import { type DomainRow } from '../service';

const STATUS_LABELS = {
  PENDING: { label: 'Nog niet geverifieerd', variant: 'warning' as const },
  VERIFIED: { label: 'Geverifieerd', variant: 'success' as const },
  FAILED: { label: 'Verificatie mislukt', variant: 'danger' as const },
};

function ActionButton({
  label,
  variant,
}: {
  label: string;
  variant?: 'outline' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} {...(variant ? { variant } : {})}>
      {label}
    </Button>
  );
}

/**
 * Shows the DNS record the tenant has to publish.
 *
 * The token is deliberately visible: it is a challenge, not a secret. Anyone
 * who can read it still cannot pass the check without also being able to
 * publish a record on the domain — which is precisely the thing being proven.
 */
function DnsInstructions({ domain }: { domain: DomainRow }) {
  const [copied, setCopied] = useState(false);
  const value = verificationRecordValue(domain.verification_token);

  return (
    <div className="mt-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface-muted)] p-3 text-xs">
      <p className="mb-2 text-[var(--tp-muted-foreground)]">
        Voeg dit TXT-record toe bij uw domeinprovider en klik daarna op
        &ldquo;Verifiëren&rdquo;.
      </p>
      <dl className="grid gap-1 sm:grid-cols-[6rem_1fr]">
        <dt className="font-medium">Type</dt>
        <dd className="font-mono">TXT</dd>
        <dt className="font-medium">Naam</dt>
        <dd className="font-mono break-all">{verificationRecordName(domain.hostname)}</dd>
        <dt className="font-medium">Waarde</dt>
        <dd className="font-mono break-all">{value}</dd>
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => setCopied(true));
        }}
      >
        {copied ? 'Gekopieerd' : 'Waarde kopiëren'}
      </Button>
    </div>
  );
}

function DomainCard({ domain }: { domain: DomainRow }) {
  const [verifyState, verifyAction] = useActionState<FormState, FormData>(
    verifyDomainAction,
    IDLE,
  );
  const [removeState, removeAction] = useActionState<FormState, FormData>(
    removeDomainAction,
    IDLE,
  );
  const [primaryState, primaryAction] = useActionState<FormState, FormData>(
    makePrimaryDomainAction,
    IDLE,
  );

  const status = STATUS_LABELS[domain.verification_status];
  const feedback = [verifyState, primaryState, removeState].find(
    (state) => state.status !== 'idle',
  );

  return (
    <li className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium break-all">{domain.hostname}</span>
        <Badge variant={status.variant}>{status.label}</Badge>
        {domain.is_primary ? <Badge variant="info">Hoofddomein</Badge> : null}
      </div>

      {feedback ? (
        <div className="mt-3">
          <FormStatus state={feedback} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {domain.verification_status === 'VERIFIED' ? null : (
          <form action={verifyAction}>
            <input type="hidden" name="id" value={domain.id} />
            <ActionButton label="Verifiëren" />
          </form>
        )}
        {domain.verification_status === 'VERIFIED' && !domain.is_primary ? (
          <form action={primaryAction}>
            <input type="hidden" name="id" value={domain.id} />
            <ActionButton label="Als hoofddomein instellen" variant="outline" />
          </form>
        ) : null}
        <form action={removeAction}>
          <input type="hidden" name="id" value={domain.id} />
          <ActionButton label="Verwijderen" variant="ghost" />
        </form>
      </div>

      {domain.verification_status === 'VERIFIED' ? null : (
        <DnsInstructions domain={domain} />
      )}
    </li>
  );
}

export function DomainManager({ domains }: { domains: readonly DomainRow[] }) {
  const [addState, addAction] = useActionState<FormState, FormData>(
    addDomainAction,
    IDLE,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={addAction} className="flex max-w-xl flex-col gap-3">
        <FormStatus state={addState} />
        <Field
          label="Domeinnaam"
          htmlFor="hostname"
          error={addState.fieldErrors?.['hostname']?.[0]}
        >
          <Input name="hostname" placeholder="vervoer.uwbedrijf.nl" />
        </Field>
        <div>
          <ActionButton label="Domein toevoegen" />
        </div>
      </form>

      {domains.length === 0 ? (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Er zijn nog geen eigen domeinnamen ingesteld.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </ul>
      )}
    </div>
  );
}
