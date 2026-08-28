import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Check } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Wat je moet doen voordat er iets te plannen valt.
 *
 * Hier stond een kaart met de titel "Wat er nog niet is", die vertelde dat
 * ritplanning en dispatch in een volgende fase zouden volgen. Die waren allang
 * gebouwd, maar het eerste scherm dat een planner zag zei nog steeds dat het
 * product niet af was.
 *
 * Wat een lege organisatie wél nodig heeft is een volgorde: zonder locaties en
 * cliënten valt er niets te plannen, en dat is niet af te lezen aan een
 * dashboard vol nullen. Elke stap is af zodra er één rij bestaat, en de hele
 * kaart verdwijnt als alles is gedaan — hij hoort niet te blijven hangen als
 * meubilair.
 */
export interface SetupStep {
  readonly label: string;
  readonly description: string;
  readonly href: Route;
  readonly done: boolean;
  /** Verborgen wanneer de gebruiker deze stap toch niet mag uitvoeren. */
  readonly visible: boolean;
}

export function GettingStarted({ steps }: { steps: readonly SetupStep[] }) {
  const shown = steps.filter((step) => step.visible);
  const remaining = shown.filter((step) => !step.done);

  if (remaining.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aan de slag</CardTitle>
        <CardDescription>
          Nog {remaining.length} {remaining.length === 1 ? 'stap' : 'stappen'} voordat u
          ritten kunt plannen. Deze kaart verdwijnt vanzelf als alles klaar is.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-1">
          {shown.map((step) => (
            <li key={step.href}>
              {step.done ? (
                <div className="flex items-start gap-3 rounded-[var(--tp-radius)] px-2 py-2.5 text-sm text-[var(--tp-muted-foreground)]">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-[var(--color-status-completed)]"
                    aria-label="Klaar"
                  />
                  <span className="line-through">{step.label}</span>
                </div>
              ) : (
                <Link
                  href={step.href}
                  className="flex min-h-11 items-start gap-3 rounded-[var(--tp-radius)] px-2 py-2.5 text-sm hover:bg-[var(--tp-surface-muted)]"
                >
                  <span
                    className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-[var(--tp-border)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{step.label}</span>
                    <span className="block text-[var(--tp-muted-foreground)]">
                      {step.description}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0 opacity-40"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
