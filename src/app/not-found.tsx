import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * De 404, in gewone taal.
 *
 * Deze pagina wordt óók getoond wanneer iets wel bestaat maar niet van jouw
 * organisatie is: dat onderscheid is bewust onzichtbaar, anders verraadt het
 * antwoord dat er bij een andere vervoerder iets met dit adres bestaat.
 * Daarom zegt de tekst "bestaat niet of is niet van jou" in één adem.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Deze pagina bestaat niet</h1>
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        Het adres klopt niet meer, of dit hoort niet bij jouw organisatie. Werd je
        hierheen gestuurd vanuit de applicatie zelf, meld het dan even.
      </p>
      <Button asChild>
        <Link href="/">Naar het beginscherm</Link>
      </Button>
    </main>
  );
}
