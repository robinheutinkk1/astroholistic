'use client';

/**
 * Het vangnet onder het vangnet: dit vangt een fout in de rootlayout zelf.
 *
 * Op dat moment is er niets meer — geen stylesheet, geen tokens, geen
 * componenten — dus alles hier is met opzet zelfvoorzienend en met de hand
 * gestyled. Als deze pagina ooit in beeld komt, is dat op zichzelf een
 * incident; de tekst hoeft alleen de weg terug te wijzen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem' }}>Er ging iets mis</h1>
          <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 1rem' }}>
            Probeer het opnieuw. Blijft dit scherm terugkomen, geef dan de code hieronder
            door aan de beheerder.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#64748b',
                margin: '0 0 1rem',
              }}
            >
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              font: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              border: 0,
              background: '#0f172a',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
