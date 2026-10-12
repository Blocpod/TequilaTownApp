/**
 * Festival ticket claiming. A ticket code can belong to exactly one account:
 * the claim is an `onlyIfNew` write of tickets/<sha256(code)>. Only the hash is
 * stored, never the raw code.
 */
import type { ClaimTicketResponse, TicketInfo } from '../shared/api';
import { bonusPoints } from '../shared/content/festival';
import type { Ctx } from './context';
import { ApiError, badRequest, json, readJson } from './http';
import { award, mutateProgress, toProgress } from './progress';
import { NO_CHANGE } from './store';
import type { TicketRecord } from './types';
import { randomCrockford, sha256hex } from './util';

export const TICKET_CODE_RE = /^[A-Z0-9-]{5,50}$/;

export type ProviderValidation = { valid: true; ticketType: 'general_admission' } | { valid: false; reason: string };

/**
 * >>> TIXR INTEGRATION POINT <<<
 *
 * Validates a ticket code with the ticketing provider. Until Tixr API credentials
 * are available this stub accepts every correctly formatted code (same behavior
 * as the MVP). When integrating:
 *   1. call Tixr's ticket lookup with `code` (server-side credentials from env)
 *   2. confirm the ticket is for this event/edition and not voided/refunded
 *   3. map the ticket tier to `ticketType`
 *   4. return { valid: false, reason } for unknown/void tickets (→ 400 INVALID_CODE)
 * Throwing an ApiError('SERVER_ERROR'/'AI_UNAVAILABLE'-style) error surfaces a
 * provider outage to the app; keep the call well inside the 60s function limit.
 */
export async function validateTicketWithProvider(code: string): Promise<ProviderValidation> {
  void code;
  return { valid: true, ticketType: 'general_admission' };
}

export const ticketKey = (code: string) => sha256hex(code);

export async function claimTicket(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const body = await readJson(ctx.req);
  if (typeof body.code !== 'string') throw badRequest('`code` is required', { field: 'code' });
  const code = body.code.trim().toUpperCase();
  if (!TICKET_CODE_RE.test(code)) throw new ApiError('INVALID_CODE', "That doesn't look like a Tequila Town ticket code");

  const validation = await validateTicketWithProvider(code);
  if (!validation.valid) throw new ApiError('INVALID_CODE', 'We could not verify that ticket', { details: { reason: validation.reason } });

  const tickets = svc.store.ns('tickets');
  const key = ticketKey(code);
  const now = svc.now();
  const fresh: TicketRecord = { userId: user.id, ref: `TT-${randomCrockford(8)}`, type: validation.ticketType, claimedAt: now.toISOString() };
  const write = await tickets.setJSON(key, fresh, { onlyIfNew: true });
  let ticket = fresh;
  let status: ClaimTicketResponse['status'] = 'claimed';
  if (!write.modified) {
    const existing = await tickets.getJSON<TicketRecord>(key);
    if (!existing) throw new ApiError('CONFLICT', 'Please try again');
    if (existing.value.userId !== user.id) throw new ApiError('TICKET_TAKEN', 'This ticket has already been claimed by another account');
    ticket = existing.value;
    status = 'already_yours';
  }

  // Idempotent: also repairs a claim whose progress update failed previously.
  const info: TicketInfo = { ref: ticket.ref, type: ticket.type, claimedAt: ticket.claimedAt };
  const { record, result } = await mutateProgress(ctx, (rec) => {
    let changed = false;
    if (!rec.ticketHashes.includes(key)) {
      rec.ticketHashes.push(key);
      changed = true;
    }
    if (!rec.ticket) {
      rec.ticket = info;
      changed = true;
    }
    const points = award(rec, 'ticket', bonusPoints.ticketClaim, 'Ticket claimed', now);
    return changed || points ? points : NO_CHANGE;
  });
  if (status === 'claimed') svc.log.info('ticket.claimed', { userId: user.id, requestId: ctx.requestId });

  const res: ClaimTicketResponse = { status, pointsAwarded: result ?? 0, progress: toProgress(record, now) };
  return json(res, status === 'claimed' ? 201 : 200);
}
