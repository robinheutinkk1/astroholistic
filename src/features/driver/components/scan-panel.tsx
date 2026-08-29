'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nfc, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isPlausibleToken, normalizeToken } from '@/features/tags/token';

type NfcState = 'unsupported' | 'idle' | 'scanning' | 'denied';

/**
 * Scanning a tag from inside the app.
 *
 * Web NFC is a progressive enhancement, not a requirement (docs/NFC.md §9).
 * It exists only in Chrome on Android; on iOS the operating system opens the
 * tag URL directly and never reaches this screen. Everything here degrades to
 * typing the code from the label, which always works.
 */
export function ScanPanel() {
  const router = useRouter();
  const [nfcState, setNfcState] = useState<NfcState>('unsupported');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNfcState('NDEFReader' in window ? 'idle' : 'unsupported');
  }, []);

  async function startScan() {
    setError(null);
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NdefReader })
        .NDEFReader;
      const reader = new Reader();
      await reader.scan();
      setNfcState('scanning');

      reader.addEventListener('reading', (event) => {
        const token = extractToken((event as NdefReadingEvent).message);
        if (token) router.push(`/t/${token}` as never);
        else setError('Deze tag bevat geen geldige Tagpoint-code.');
      });
    } catch {
      // Permission refused, or NFC switched off in the OS. Not an error the
      // driver can fix here, so point them at what does work.
      setNfcState('denied');
    }
  }

  function submitManual() {
    const token = normalizeToken(manual);
    if (!isPlausibleToken(token)) {
      setError('Die code klopt niet. Kijk op de achterkant van de tag.');
      return;
    }
    router.push(`/t/${token}` as never);
  }

  return (
    <div className="flex flex-col gap-5">
      {nfcState === 'unsupported' ? (
        <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface)] p-4 text-sm text-[var(--tp-muted-foreground)]">
          Dit toestel kan niet vanuit de app scannen. Houd de tag tegen de achterkant van
          je telefoon, die opent hem vanzelf. Of typ de code hieronder over.
        </p>
      ) : null}

      {nfcState === 'idle' ? (
        <Button size="touch" onClick={() => void startScan()}>
          <Nfc aria-hidden="true" />
          Scannen starten
        </Button>
      ) : null}

      {nfcState === 'scanning' ? (
        <p
          role="status"
          className="rounded-[var(--tp-radius)] border-2 border-[var(--tp-primary)] bg-[var(--tp-surface)] p-6 text-center text-base"
        >
          Houd de tag tegen je telefoon…
        </p>
      ) : null}

      {nfcState === 'denied' ? (
        <p className="rounded-[var(--tp-radius)] bg-amber-50 p-4 text-sm text-amber-900">
          Scannen is geweigerd of NFC staat uit. Zet NFC aan in je instellingen, of typ de
          code over.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="manual" className="flex items-center gap-2 text-sm font-medium">
          <Keyboard className="size-4" aria-hidden="true" />
          Code overtypen
        </label>
        <Input
          id="manual"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="De code op de achterkant van de tag"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button variant="outline" size="touch" onClick={submitManual}>
          Verder
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--tp-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface NdefReader {
  scan(): Promise<void>;
  addEventListener(type: 'reading', listener: (event: Event) => void): void;
}

interface NdefReadingEvent extends Event {
  message: { records: { recordType: string; data?: DataView }[] };
}

/** Pulls the token out of a tag's URL record. */
function extractToken(message: NdefReadingEvent['message']): string | null {
  for (const record of message.records) {
    if (record.recordType !== 'url' || !record.data) continue;
    const url = new TextDecoder().decode(record.data);
    const match = /\/t\/([^/?#]+)/.exec(url);
    if (match?.[1]) return normalizeToken(match[1]);
  }
  return null;
}
