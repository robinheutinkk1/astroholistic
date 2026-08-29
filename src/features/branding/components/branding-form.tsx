'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { updateBrandingAction } from '../actions';
import { type BrandingRow } from '../service';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Huisstijl opslaan
    </Button>
  );
}

/**
 * The colour inputs are `type="color"` with a text field beside them. A native
 * colour picker can only produce a hex value, which is exactly what the schema
 * and the database CHECK constraint accept — but the text field stays because
 * a brand guide gives you a hex code, not a colour wheel.
 */
function ColorField({
  name,
  label,
  value,
  error,
}: {
  name: string;
  label: string;
  value: string | null;
  error: string | undefined;
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint="Bijvoorbeeld #1f47d6.">
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} kiezen`}
          defaultValue={value ?? '#1f47d6'}
          onChange={(event) => {
            const text = document.getElementById(name);
            if (text instanceof HTMLInputElement) text.value = event.target.value;
          }}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)]"
        />
        <Input name={name} id={name} defaultValue={value ?? ''} placeholder="#1f47d6" />
      </div>
    </Field>
  );
}

export function BrandingForm({ branding }: { branding: BrandingRow | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateBrandingAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />

      <Field
        label="Weergavenaam"
        htmlFor="displayName"
        error={state.fieldErrors?.['displayName']?.[0]}
      >
        <Input
          name="displayName"
          defaultValue={branding?.display_name ?? ''}
          maxLength={60}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          name="primaryColor"
          label="Primaire kleur"
          value={branding?.primary_color ?? null}
          error={state.fieldErrors?.['primaryColor']?.[0]}
        />
        <ColorField
          name="secondaryColor"
          label="Accentkleur"
          value={branding?.secondary_color ?? null}
          error={state.fieldErrors?.['secondaryColor']?.[0]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Support-e-mailadres"
          htmlFor="supportEmail"
          error={state.fieldErrors?.['supportEmail']?.[0]}
        >
          <Input
            name="supportEmail"
            type="email"
            defaultValue={branding?.support_email ?? ''}
          />
        </Field>
        <Field
          label="Supporttelefoonnummer"
          htmlFor="supportPhone"
          error={state.fieldErrors?.['supportPhone']?.[0]}
        >
          <Input name="supportPhone" defaultValue={branding?.support_phone ?? ''} />
        </Field>
      </div>

      <label className="flex max-w-prose items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="hidePlatformBranding"
          defaultChecked={branding?.hide_platform_branding ?? false}
          className="mt-0.5"
        />
        <span>
          Verberg &ldquo;Mogelijk gemaakt door TagPoint&rdquo; op pagina&apos;s die
          cliënten en ouders zien.
        </span>
      </label>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
