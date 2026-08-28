'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { eraseClientAction } from '../actions';

function EraseButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" loading={pending}>
      Persoonsgegevens definitief wissen
    </Button>
  );
}

/**
 * The two data-subject rights, on the screen where the person is.
 *
 * Erasure is deliberately explained rather than hidden behind an "are you
 * sure" box. What the operator needs before clicking is which data survives
 * and which does not — a yes/no dialog asks a question they cannot answer.
 */
export function PrivacyCard({
  clientId,
  anonymizedAt,
  canErase,
}: {
  clientId: string;
  anonymizedAt: string | null;
  canErase: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(eraseClientAction, IDLE);

  if (anonymizedAt) {
    return (
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        De persoonsgegevens van deze cliënt zijn op{' '}
        {new Date(anonymizedAt).toLocaleDateString('nl-NL')} gewist. De ritten zijn
        bewaard als vervoersadministratie.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatus state={state} />

      <div>
        <h3 className="text-sm font-medium">Inzage en dataportabiliteit</h3>
        <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
          Alles wat dit systeem over deze persoon bewaart, in één bestand. Vraagt een
          cliënt of ouder om inzage, dan is dit het antwoord.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <a href={`/api/clienten/${clientId}/export`} download>
            Gegevens downloaden (JSON)
          </a>
        </Button>
      </div>

      {canErase ? (
        <div className="border-t border-[var(--tp-border)] pt-4">
          <h3 className="text-sm font-medium">Recht op vergetelheid</h3>
          <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
            Naam, adres, telefoonnummer en e-mailadres worden gewist, de eventuele
            portaal-login wordt verwijderd en NFC-tags worden losgekoppeld.
            Contactpersonen die verder nergens aan gekoppeld zijn, worden ook gewist.
            <strong className="mt-1 block">
              De ritten blijven bestaan zonder naam: dat is uw vervoersadministratie, en
              die moet u bewaren.
            </strong>
            Dit kan niet ongedaan worden gemaakt.
          </p>
          <form action={action} className="mt-3">
            <input type="hidden" name="id" value={clientId} />
            <EraseButton />
          </form>
        </div>
      ) : null}
    </div>
  );
}
