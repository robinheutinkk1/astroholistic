import 'server-only';
import { resolveTxt } from 'node:dns/promises';
import { type TxtResolver } from './verify';

/**
 * The live DNS resolver. Kept apart from ./verify so the verification logic
 * stays testable without touching the network.
 */
export const nodeTxtResolver: TxtResolver = (name) => resolveTxt(name);
