'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useUpdateParams } from '@/components/ui/list-controls';
import { MAX_PERIOD_DAYS, daysBetween, type ReportPeriod } from '../schema';

/**
 * The period lives in the URL, not in component state.
 *
 * That is what makes a report shareable: a planner can paste the link into an
 * e-mail and the recipient sees the same figures — subject to their own
 * permissions, since the numbers are recomputed server-side for whoever opens
 * it. Nothing about the data travels in the URL, only the question.
 */
export function PeriodPicker({ period }: { period: ReportPeriod }) {
  const updateParams = useUpdateParams();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const span = daysBetween(from, to);
  const error =
    from > to
      ? 'De einddatum ligt vóór de begindatum.'
      : span > MAX_PERIOD_DAYS
        ? `Kies een periode van maximaal ${MAX_PERIOD_DAYS} dagen.`
        : null;

  function apply() {
    if (error) return;
    updateParams({ from, to });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <Field label="Van" htmlFor="from" className="w-44">
        <Input
          type="date"
          name="from"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </Field>
      <Field label="Tot en met" htmlFor="to" className="w-44" error={error ?? undefined}>
        <Input
          type="date"
          name="to"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </Field>
      <Button type="submit" disabled={error !== null}>
        Toon periode
      </Button>
    </form>
  );
}
