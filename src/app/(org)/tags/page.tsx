import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TagManager } from '@/features/tags/components/tag-manager';
import { listTags } from '@/features/tags/service';
import { isTagFeatureConfigured, isTemporaryHost } from '@/features/tags/config';
import { loadPickerOptions } from '@/features/rides/pickers';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'NFC-tags' };

export default async function TagsPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('tags.view')) redirect('/dashboard');

  const [tags, options] = await Promise.all([
    listTags(membership.organizationId),
    loadPickerOptions(membership.organizationId),
  ]);

  // Vooraf zeggen dat het niet gaat werken, in plaats van na de klik. Zonder
  // TAG_TOKEN_PEPPER kan er geen token worden gehasht en faalde het aanmaken
  // met "Er ging iets mis" — een melding waar niemand iets aan heeft, want er
  // was niets mis met wat de gebruiker deed.
  const configured = isTagFeatureConfigured();

  // De hostnaam belandt op een fysieke tag. Verandert hij later, dan wijzen
  // alle uitgeschreven tags naar een adres dat ooit verdwijnt.
  const temporaryHost = isTemporaryHost(publicEnv.NEXT_PUBLIC_APP_URL);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">NFC-tags</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Eén tag per cliënt. Dezelfde tag werkt als NFC en als QR-code.
        </p>
      </div>

      {configured ? null : (
        <div
          role="alert"
          className="rounded-[var(--tp-radius)] border border-[var(--tp-danger)] bg-red-50 p-4 text-sm"
        >
          <p className="font-medium">Tags zijn nog niet aangezet op dit platform.</p>
          <p className="mt-1 text-[var(--tp-muted-foreground)]">
            Aanmaken lukt daarom niet. De beheerder van het platform moet de
            omgevingsvariabele <code className="font-mono">TAG_TOKEN_PEPPER</code>{' '}
            instellen — een willekeurige waarde van minstens 32 tekens. Zie
            docs/DEPLOYMENT.md stap 5.
          </p>
        </div>
      )}

      {configured && temporaryHost ? (
        <div
          role="alert"
          className="rounded-[var(--tp-radius)] border border-[var(--tp-warning)] bg-amber-50 p-4 text-sm"
        >
          <p className="font-medium">
            Wacht met tags uitschrijven tot het eigen domein er staat.
          </p>
          <p className="mt-1 text-[var(--tp-muted-foreground)]">
            De link op een tag begint nu met{' '}
            <code className="font-mono">{publicEnv.NEXT_PUBLIC_APP_URL}</code>. Dat is een
            tijdelijk adres van de hostingpartij. Tags die je nu beschrijft blijven
            daarnaar wijzen, óók na de overstap naar het eigen domein — en ze stoppen met
            werken zodra dat tijdelijke adres verdwijnt. Omzetten kan niet: de code op een
            tag is niet op te vragen, dus elke tag zou opnieuw moeten worden aangemaakt en
            beschreven.
          </p>
          <p className="mt-1 text-[var(--tp-muted-foreground)]">
            Uitproberen mag; alleen het beschrijven van échte tags kan beter wachten.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Op de tag zelf staat alleen de code — nooit de naam van de cliënt. Wie hem
            vindt, kan er niets mee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagManager
            tags={tags}
            clients={options.clients}
            canManage={configured && membership.permissions.has('tags.manage')}
            appUrl={publicEnv.NEXT_PUBLIC_APP_URL}
          />
        </CardContent>
      </Card>
    </div>
  );
}
