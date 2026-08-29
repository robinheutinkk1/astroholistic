import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Enums } from '@/types/database';
import { type ReportPeriod, type ReportScope } from './schema';

/**
 * Aggregation happens in the database (migration 0022), not here.
 *
 * The alternative, fetching every ride and counting in JavaScript, works with
 * the demo data and becomes the slowest thing in the product on a real
 * organisation's year. The functions are `security invoker`, so RLS still
 * decides which rides are counted.
 *
 * Het filter op opdrachtgever en locatie gaat mee de database in (migratie
 * 0031) en niet achteraf in JavaScript: anders haal je een jaar aan ritten op
 * om er tien over te houden.
 */
export interface RideSummary {
  readonly total: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly absent: number;
  readonly problem: number;
  readonly open: number;
  readonly checkinNfc: number;
  readonly checkinQr: number;
  readonly checkinManual: number;
  readonly measured: number;
  readonly onTime: number;
  readonly late: number;
  readonly avgDelaySeconds: number | null;
}

export interface DayRow {
  readonly day: string;
  readonly total: number;
  readonly completed: number;
  readonly absent: number;
  readonly cancelled: number;
}

export interface DriverRow {
  readonly driverId: string | null;
  readonly driverName: string | null;
  readonly total: number;
  readonly completed: number;
  readonly absent: number;
  readonly measured: number;
  readonly onTime: number;
  readonly avgDelaySeconds: number | null;
}

export interface ClientRow {
  readonly clientId: string | null;
  readonly clientName: string | null;
  readonly total: number;
  readonly completed: number;
  readonly absent: number;
  readonly cancelled: number;
  readonly lastRideDate: string | null;
}

export interface AbsenceReasonRow {
  readonly reason: Enums<'absence_reason'> | null;
  readonly total: number;
}

const EMPTY_SUMMARY: RideSummary = {
  total: 0,
  completed: 0,
  cancelled: 0,
  absent: 0,
  problem: 0,
  open: 0,
  checkinNfc: 0,
  checkinQr: 0,
  checkinManual: 0,
  measured: 0,
  onTime: 0,
  late: 0,
  avgDelaySeconds: null,
};

/**
 * De filterargumenten, of niets.
 *
 * `undefined` in plaats van `null`, want dan laat PostgREST de parameter weg en
 * pakt de functie zijn eigen standaard. Expliciet null doorsturen werkt hier
 * ook, maar dit houdt de aanroep gelijk aan wat de database zelf verwacht.
 */
function scopeArguments(scope: ReportScope): {
  p_care_organization_id?: string;
  p_location_id?: string;
} {
  return {
    ...(scope.careOrganizationId
      ? { p_care_organization_id: scope.careOrganizationId }
      : {}),
    ...(scope.locationId ? { p_location_id: scope.locationId } : {}),
  };
}

/** Postgres returns bigint as a string over PostgREST; NULL means zero rows. */
function count(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchSummary(
  organizationId: string,
  scope: ReportScope,
): Promise<RideSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_ride_summary', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  const row = data?.[0];
  if (!row) return EMPTY_SUMMARY;

  return {
    total: count(row.total),
    completed: count(row.completed),
    cancelled: count(row.cancelled),
    absent: count(row.absent),
    problem: count(row.problem),
    open: count(row.open),
    checkinNfc: count(row.checkin_nfc),
    checkinQr: count(row.checkin_qr),
    checkinManual: count(row.checkin_manual),
    measured: count(row.measured),
    onTime: count(row.on_time),
    late: count(row.late),
    avgDelaySeconds: nullableNumber(row.avg_delay_seconds),
  };
}

export async function fetchPerDay(
  organizationId: string,
  scope: ReportScope,
): Promise<DayRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_rides_per_day', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  return (data ?? []).map((row) => ({
    day: row.day ?? '',
    total: count(row.total),
    completed: count(row.completed),
    absent: count(row.absent),
    cancelled: count(row.cancelled),
  }));
}

export async function fetchPerDriver(
  organizationId: string,
  scope: ReportScope,
): Promise<DriverRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_by_driver', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  return (data ?? []).map((row) => ({
    driverId: row.driver_id,
    driverName: row.driver_name,
    total: count(row.total),
    completed: count(row.completed),
    absent: count(row.absent),
    measured: count(row.measured),
    onTime: count(row.on_time),
    avgDelaySeconds: nullableNumber(row.avg_delay_seconds),
  }));
}

export async function fetchPerClient(
  organizationId: string,
  scope: ReportScope,
): Promise<ClientRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_by_client', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  return (data ?? []).map((row) => ({
    clientId: row.client_id,
    clientName: row.client_name,
    total: count(row.total),
    completed: count(row.completed),
    absent: count(row.absent),
    cancelled: count(row.cancelled),
    lastRideDate: row.last_ride_date,
  }));
}

export async function fetchAbsenceReasons(
  organizationId: string,
  scope: ReportScope,
): Promise<AbsenceReasonRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_absence_reasons', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  return (data ?? []).map((row) => ({
    reason: row.reason,
    total: count(row.total),
  }));
}

/**
 * The care organisation's own clients. Scoped by relationship, not by role.
 *
 * Neemt bewust alleen een periode. Filteren op opdrachtgever zou hier niets
 * betekenen: wie dit aanroept ís de opdrachtgever, en de relatie bepaalt al
 * welke cliënten hij ziet.
 */
export async function fetchPortalClientSummary(
  period: ReportPeriod,
): Promise<ClientRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_portal_client_summary', {
    p_from: period.from,
    p_to: period.to,
  });

  return (data ?? []).map((row) => ({
    clientId: row.client_id,
    clientName: row.client_name,
    total: count(row.total),
    completed: count(row.completed),
    absent: count(row.absent),
    cancelled: count(row.cancelled),
    lastRideDate: null,
  }));
}

export interface LocationRow {
  readonly locationId: string | null;
  readonly locationName: string | null;
  readonly careOrganizationId: string | null;
  readonly careOrganizationName: string | null;
  readonly total: number;
  readonly completed: number;
  readonly absent: number;
  readonly cancelled: number;
}

/**
 * Ritten per locatie.
 *
 * Een rit telt bij de locatie waar hij vandaan komt én bij waar hij heen gaat,
 * dus de som van de regels is hoger dan het totaal. Dat is de vraag die dit
 * rapport beantwoordt: hoe druk is deze vestiging.
 */
export async function fetchPerLocation(
  organizationId: string,
  scope: ReportScope,
): Promise<LocationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('report_by_location', {
    p_organization_id: organizationId,
    p_from: scope.from,
    p_to: scope.to,
    ...scopeArguments(scope),
  });

  return (data ?? []).map((row) => ({
    locationId: row.location_id,
    locationName: row.location_name,
    careOrganizationId: row.care_organization_id,
    careOrganizationName: row.care_organization_name,
    total: count(row.total),
    completed: count(row.completed),
    absent: count(row.absent),
    cancelled: count(row.cancelled),
  }));
}
