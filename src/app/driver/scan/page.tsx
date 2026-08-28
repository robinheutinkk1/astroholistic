import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ScanPanel } from '@/features/driver/components/scan-panel';
import { requireDriverContext } from '@/features/driver/service';

export const metadata: Metadata = { title: 'Tag scannen' };

export default async function DriverScanPage() {
  await requireDriverContext();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/driver"
        className="flex min-h-11 items-center gap-1 text-sm text-[var(--tp-muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Terug
      </Link>

      <h1 className="text-xl font-semibold">Tag scannen</h1>
      <ScanPanel />
    </div>
  );
}
