import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type RideSummary } from '../service';

/**
 * Percentages are shown with their denominator ("46 van 62"), never on their
 * own. A punctuality of 100% over two measured rides reads as an achievement
 * and is noise; the reader deserves to see which of the two it is.
 */
function share(part: number, whole: number): string {
  if (whole === 0) return '-';
  return `${Math.round((part / whole) * 100)}%`;
}

function Figure({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | undefined;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-[var(--tp-muted-foreground)]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {detail ? (
          <p className="mt-0.5 text-xs text-[var(--tp-muted-foreground)]">{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ summary }: { summary: RideSummary }) {
  const delay = summary.avgDelaySeconds;
  const delayLabel =
    delay === null
      ? '-'
      : `${delay >= 0 ? '+' : '−'}${Math.abs(Math.round(delay / 60))} min`;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Figure
        label="Ritten in deze periode"
        value={String(summary.total)}
        detail={`${summary.open} nog open`}
      />
      <Figure
        label="Afgerond"
        value={share(summary.completed, summary.total)}
        detail={`${summary.completed} van ${summary.total}`}
      />
      <Figure
        label="Niet gereden"
        value={String(summary.absent + summary.cancelled)}
        detail={`${summary.absent} afwezig · ${summary.cancelled} geannuleerd`}
      />
      <Figure
        label="Op tijd"
        value={share(summary.onTime, summary.measured)}
        detail={
          summary.measured === 0
            ? 'Geen check-ins gemeten'
            : `${summary.onTime} van ${summary.measured} · gemiddeld ${delayLabel}`
        }
      />
    </div>
  );
}

/**
 * How clients were checked in.
 *
 * This is the figure that shows whether the tags are actually being used
 * (decision D-18). Handing out NFC stickers and never checking this is how a
 * feature quietly stops being used while everyone assumes it works.
 */
export function CheckinMethods({ summary }: { summary: RideSummary }) {
  const scanned = summary.checkinNfc + summary.checkinQr;
  const rows = [
    { label: 'NFC-tag', value: summary.checkinNfc },
    { label: 'QR-code', value: summary.checkinQr },
    { label: 'Handmatig afgevinkt', value: summary.checkinManual },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoe is er ingecheckt?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {summary.measured === 0 ? (
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            In deze periode is er niet ingecheckt.
          </p>
        ) : (
          <>
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0">{row.label}</span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--tp-surface-muted)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-[var(--tp-primary)]"
                    style={{ width: `${(row.value / summary.measured) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right tabular-nums">
                  {row.value} ({share(row.value, summary.measured)})
                </span>
              </div>
            ))}
            <p className="mt-1 text-xs text-[var(--tp-muted-foreground)]">
              {share(scanned, summary.measured)} van de check-ins ging via een tag of
              QR-code. Loopt dit terug, dan worden de tags in de praktijk niet gebruikt.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
