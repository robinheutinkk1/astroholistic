import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { type ClientRow, type DayRow, type DriverRow } from '../service';

function delayLabel(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return 'op tijd';
  return minutes > 0 ? `${minutes} min later` : `${Math.abs(minutes)} min eerder`;
}

function share(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`;
}

export function PerDayTable({ rows }: { rows: readonly DayRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Geen ritten in deze periode"
        description="Kies een andere periode om cijfers te zien."
      />
    );
  }

  return (
    <Table caption="Ritten per dag">
      <Thead>
        <Th>Datum</Th>
        <Th className="text-right">Ritten</Th>
        <Th className="text-right">Afgerond</Th>
        <Th className="text-right">Afwezig</Th>
        <Th className="text-right">Geannuleerd</Th>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr key={row.day}>
            <Td>{row.day}</Td>
            <Td className="text-right tabular-nums">{row.total}</Td>
            <Td className="text-right tabular-nums">{row.completed}</Td>
            <Td className="text-right tabular-nums">{row.absent}</Td>
            <Td className="text-right tabular-nums">{row.cancelled}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

/**
 * Per driver.
 *
 * Deliberately not sorted by punctuality and deliberately without a score.
 * These are operational figures — where do rides run late, and does a route
 * need more time — not a ranking of employees. The ordering is by volume, so
 * the busiest routes are at the top; see docs/RISKS_AND_DECISIONS.md D-24.
 */
export function PerDriverTable({ rows }: { rows: readonly DriverRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Geen ritten in deze periode"
        description="Kies een andere periode om cijfers te zien."
      />
    );
  }

  return (
    <Table caption="Ritten per chauffeur">
      <Thead>
        <Th>Chauffeur</Th>
        <Th className="text-right">Ritten</Th>
        <Th className="text-right">Afgerond</Th>
        <Th className="text-right">Afwezig</Th>
        <Th className="text-right">Op tijd</Th>
        <Th className="text-right">Gemiddeld</Th>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr key={row.driverId ?? 'onbekend'}>
            <Td>{row.driverName ?? 'Niet toegewezen'}</Td>
            <Td className="text-right tabular-nums">{row.total}</Td>
            <Td className="text-right tabular-nums">{row.completed}</Td>
            <Td className="text-right tabular-nums">{row.absent}</Td>
            <Td className="text-right tabular-nums">
              {share(row.onTime, row.measured)}
              <span className="ml-1 text-xs text-[var(--tp-muted-foreground)]">
                ({row.onTime}/{row.measured})
              </span>
            </Td>
            <Td className="text-right tabular-nums">{delayLabel(row.avgDelaySeconds)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

export function PerClientTable({ rows }: { rows: readonly ClientRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Geen ritten in deze periode"
        description="Kies een andere periode om cijfers te zien."
      />
    );
  }

  return (
    <Table caption="Ritten per cliënt">
      <Thead>
        <Th>Cliënt</Th>
        <Th className="text-right">Ritten</Th>
        <Th className="text-right">Afgerond</Th>
        <Th className="text-right">Afwezig</Th>
        <Th className="text-right">Geannuleerd</Th>
        <Th>Laatste rit</Th>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr key={row.clientId ?? 'onbekend'}>
            <Td>{row.clientName ?? 'Onbekend'}</Td>
            <Td className="text-right tabular-nums">{row.total}</Td>
            <Td className="text-right tabular-nums">{row.completed}</Td>
            <Td className="text-right tabular-nums">{row.absent}</Td>
            <Td className="text-right tabular-nums">{row.cancelled}</Td>
            <Td>{row.lastRideDate ?? '—'}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
