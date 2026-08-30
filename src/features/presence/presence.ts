import { type Enums } from '@/types/database';

/**
 * Van ritstatus naar aanwezigheid, in de woorden van een begeleider.
 *
 * De vraag op een dagbesteding is niet "wat is de ritstatus" maar "is Jan er
 * al". Dit is de vertaling, en hij is bewust grof: vier kleuren die je vanaf
 * de andere kant van de gang kunt lezen.
 *
 * De volgorde van de emmers is de volgorde van urgentie op het bord: eerst
 * wie afwezig is gemeld (daar moet iets mee), dan wie onderweg is, dan wie
 * nog verwacht wordt, en pas onderaan wie er al veilig is.
 */
export type RideStatus = Enums<'ride_status'>;

export type PresenceBucket = 'PRESENT' | 'EN_ROUTE' | 'EXPECTED' | 'ABSENT' | 'CANCELLED';

export function presenceOf(status: RideStatus): PresenceBucket {
  switch (status) {
    case 'ARRIVED':
    case 'COMPLETED':
      return 'PRESENT';
    case 'CLIENT_CHECKED_IN':
    case 'TRIP_STARTED':
      return 'EN_ROUTE';
    case 'CLIENT_ABSENT':
      return 'ABSENT';
    case 'CANCELLED':
      return 'CANCELLED';
    // PROBLEM houdt de laatste bekende plek in het proces; het bord toont hem
    // als onderweg met een markering, want "er is iets" is voor de begeleider
    // belangrijker dan de precieze processtap.
    case 'PROBLEM':
      return 'EN_ROUTE';
    default:
      return 'EXPECTED';
  }
}

export const PRESENCE_LABELS: Record<PresenceBucket, string> = {
  PRESENT: 'Aanwezig',
  EN_ROUTE: 'Onderweg',
  EXPECTED: 'Verwacht',
  ABSENT: 'Afwezig',
  CANCELLED: 'Geannuleerd',
};

/** Vaste weergavevolgorde van de groepen op het bord. */
export const PRESENCE_ORDER: readonly PresenceBucket[] = [
  'ABSENT',
  'EN_ROUTE',
  'EXPECTED',
  'PRESENT',
  'CANCELLED',
];

export interface PresenceCounts {
  readonly total: number;
  readonly present: number;
  readonly enRoute: number;
  readonly expected: number;
  readonly absent: number;
  readonly cancelled: number;
}

export function countPresence(statuses: readonly RideStatus[]): PresenceCounts {
  const counts = { present: 0, enRoute: 0, expected: 0, absent: 0, cancelled: 0 };
  for (const status of statuses) {
    switch (presenceOf(status)) {
      case 'PRESENT':
        counts.present += 1;
        break;
      case 'EN_ROUTE':
        counts.enRoute += 1;
        break;
      case 'EXPECTED':
        counts.expected += 1;
        break;
      case 'ABSENT':
        counts.absent += 1;
        break;
      case 'CANCELLED':
        counts.cancelled += 1;
        break;
    }
  }
  // Geannuleerd telt niet mee in het totaal dat de begeleider verwacht: "15
  // van 18" moet gaan over wie er vandaag daadwerkelijk zou komen.
  return { ...counts, total: statuses.length - counts.cancelled };
}
