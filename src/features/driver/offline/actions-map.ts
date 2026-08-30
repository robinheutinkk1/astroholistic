import {
  driverActionAction,
  markStopArrivedAction,
  reportAbsenceAction,
  reportProblemAction,
} from '../actions';
import { type FormState, IDLE } from '@/lib/errors/form-state';
import { type QueuedAction } from './queue';

/**
 * Van wachtrijsoort naar server action.
 *
 * Eén tabel, twee gebruikers: de verzendhook (directe poging) en de banner
 * (herhaalpoging uit de wachtrij). Dezelfde actie voor allebei, zodat een
 * herhaalde registratie exact dezelfde controles doorloopt als een directe.
 */
const ACTIONS: Record<
  QueuedAction['kind'],
  (previous: FormState, formData: FormData) => Promise<FormState>
> = {
  'ride-action': driverActionAction,
  'stop-arrived': markStopArrivedAction,
  absence: reportAbsenceAction,
  problem: reportProblemAction,
};

export async function runQueuedKind(
  kind: QueuedAction['kind'],
  formData: FormData,
): Promise<FormState> {
  return ACTIONS[kind](IDLE, formData);
}
