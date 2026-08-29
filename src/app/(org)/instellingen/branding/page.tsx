import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandingForm } from '@/features/branding/components/branding-form';
import { LogoUpload } from '@/features/branding/components/logo-upload';
import { getBranding } from '@/features/branding/service';
import { logoUrl } from '@/features/branding/url';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Huisstijl' };

export default async function BrandingSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('branding.manage')) redirect('/instellingen');

  const branding = await getBranding(membership.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Huisstijl</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
          Naam, logo en kleuren van {membership.organizationName}. Deze worden gebruikt in
          de planning, de chauffeurs-app en de portalen voor cliënten, ouders en
          opdrachtgevers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoUpload logoUrl={logoUrl(branding?.logo_path, branding?.updated_at)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Naam en kleuren</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandingForm branding={branding} />
        </CardContent>
      </Card>
    </div>
  );
}
