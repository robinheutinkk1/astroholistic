'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useUpdateParams } from '@/components/ui/list-controls';
import { MAX_PERIOD_DAYS, daysBetween, type ReportScope } from '../schema';

export interface FilterOption {
  readonly id: string;
  readonly name: string;
  /** Alleen bij locaties: de opdrachtgever waar deze vestiging bij hoort. */
  readonly careOrganizationId?: string | null;
}

/**
 * Periode, opdrachtgever en locatie. Alles staat in de URL, niet in state.
 *
 * Dat maakt een rapport deelbaar: een planner plakt de link in een mail en de
 * ontvanger ziet dezelfde vraag. Niet dezelfde cijfers per se, want die worden
 * opnieuw berekend met de rechten van wie hem opent. Er reist geen enkel
 * gegeven mee in de URL, alleen de vraag.
 */
export function ScopePicker({
  scope,
  careOrganizations,
  locations,
}: {
  scope: ReportScope;
  careOrganizations: readonly FilterOption[];
  locations: readonly FilterOption[];
}) {
  const updateParams = useUpdateParams();
  const [from, setFrom] = useState(scope.from);
  const [to, setTo] = useState(scope.to);
  const [careOrganizationId, setCareOrganizationId] = useState(
    scope.careOrganizationId ?? '',
  );
  const [locationId, setLocationId] = useState(scope.locationId ?? '');

  const span = daysBetween(from, to);
  const error =
    from > to
      ? 'De einddatum ligt vóór de begindatum.'
      : span > MAX_PERIOD_DAYS
        ? `Kies een periode van maximaal ${MAX_PERIOD_DAYS} dagen.`
        : null;

  /*
   * Kiest iemand een opdrachtgever, dan blijven alleen diens vestigingen in de
   * locatielijst staan. Een keuze die daar niet meer bij hoort wordt gewist:
   * "Humankind" plus "woonadres Jansen" levert nul ritten op en ziet eruit als
   * een lege database.
   */
  function locationsFor(careOrgId: string): readonly FilterOption[] {
    return careOrgId
      ? locations.filter((location) => location.careOrganizationId === careOrgId)
      : locations;
  }

  const visibleLocations = locationsFor(careOrganizationId);

  function chooseCareOrganization(value: string) {
    setCareOrganizationId(value);
    if (locationId && !locationsFor(value).some((option) => option.id === locationId)) {
      setLocationId('');
    }
  }

  function apply() {
    if (error) return;
    updateParams({
      from,
      to,
      // Een lege waarde haalt de parameter uit de URL in plaats van hem leeg
      // achter te laten.
      opdrachtgever: careOrganizationId || undefined,
      locatie: locationId || undefined,
    });
  }

  function reset() {
    setCareOrganizationId('');
    setLocationId('');
    updateParams({ from, to, opdrachtgever: undefined, locatie: undefined });
  }

  const filtering = careOrganizationId !== '' || locationId !== '';

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <Field label="Van" htmlFor="from" className="w-40">
        <Input
          type="date"
          name="from"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </Field>

      <Field label="Tot en met" htmlFor="to" className="w-40" error={error ?? undefined}>
        <Input
          type="date"
          name="to"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </Field>

      {careOrganizations.length > 0 ? (
        <Field label="Opdrachtgever" htmlFor="opdrachtgever" className="w-56">
          <Select
            name="opdrachtgever"
            value={careOrganizationId}
            onChange={(event) => chooseCareOrganization(event.target.value)}
            options={[
              { value: '', label: 'Alle opdrachtgevers' },
              ...careOrganizations.map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        </Field>
      ) : null}

      {locations.length > 0 ? (
        <Field label="Locatie" htmlFor="locatie" className="w-56">
          <Select
            name="locatie"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={[
              { value: '', label: 'Alle locaties' },
              ...visibleLocations.map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        </Field>
      ) : null}

      <Button type="submit" disabled={error !== null}>
        Toon
      </Button>

      {filtering ? (
        <Button type="button" variant="outline" onClick={reset}>
          Filter wissen
        </Button>
      ) : null}
    </form>
  );
}
