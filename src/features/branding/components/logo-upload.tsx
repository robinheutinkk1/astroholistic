'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { removeLogoAction, uploadLogoAction } from '../actions';

function SubmitButton({ label, variant }: { label: string; variant?: 'outline' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...(variant ? { variant } : {})}>
      {label}
    </Button>
  );
}

export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction] = useActionState<FormState, FormData>(
    uploadLogoAction,
    IDLE,
  );
  const [removeState, removeAction] = useActionState<FormState, FormData>(
    removeLogoAction,
    IDLE,
  );

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <FormStatus state={uploadState.status === 'idle' ? removeState : uploadState} />

      {logoUrl ? (
        <div className="flex items-center gap-4">
          {/* unoptimized: the file already passed a size and format check, and
              running it through the image optimiser would mean proxying every
              tenant's logo through the app server for no gain. */}
          <Image
            src={logoUrl}
            alt="Huidig logo"
            width={160}
            height={64}
            unoptimized
            className="h-16 w-auto rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] object-contain p-2"
          />
          <form action={removeAction}>
            <SubmitButton label="Logo verwijderen" variant="outline" />
          </form>
        </div>
      ) : (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Er is nog geen logo ingesteld.
        </p>
      )}

      <form action={uploadAction} className="flex flex-col gap-3">
        <Field
          label="Nieuw logo"
          htmlFor="logo"
          error={uploadState.fieldErrors?.['logo']?.[0]}
        >
          <input
            type="file"
            name="logo"
            id="logo"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm file:mr-3 file:rounded-[var(--tp-radius)] file:border file:border-[var(--tp-border)] file:bg-[var(--tp-surface-muted)] file:px-3 file:py-1.5 file:text-sm"
          />
        </Field>
        <div>
          <SubmitButton label="Logo uploaden" />
        </div>
      </form>
    </div>
  );
}
