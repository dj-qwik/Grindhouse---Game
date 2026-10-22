import type { Address } from 'viem'

/**
 * Match format (Grindhouse build bible §1, §3, §20): ONE round, last skater standing.
 *  - Free-for-all, one life, no respawns, 2–8 players.
 *  - The round is decided by the deterministic simulation: the last living skater wins, or at exactly
 *    60.0 s the server ranks survivors by (1) health, (2) eliminations, (3) damage dealt, (4) a seeded
 *    tiebreak order. Simultaneous deaths on one tick use health immediately before that tick.
 *  - So the round ledger always holds exactly one round, and its winner is the champion.
 *
 * The exported names are kept from the multi-round template so the evidence/co-signer code is unchanged:
 * a match is simply a ledger of exactly one round.
 */
export const WINS_TO_CHAMPION = 1
export const OPEN_ROUNDS = 1
export const MIN_ROUNDS = 1

export function maxRounds(_playerCount: number): number {
  return 1
}

/** Single-round matches have no finals. Kept for API compatibility. */
export function finalistsFor(_roundWinners: readonly Address[]): Address[] | null {
  return null
}

export class RoundLedgerError extends Error {}

/**
 * Validates the round ledger against the locked roster and returns the champion: exactly one round,
 * won by a roster member.
 */
export function championFromRounds(roundWinners: readonly Address[], roster: readonly Address[]): Address {
  const members = new Set(roster.map((a) => a.toLowerCase()))
  if (members.size !== roster.length) throw new RoundLedgerError('roster has duplicates')
  if (roster.length < 2) throw new RoundLedgerError('fewer than 2 players')
  if (roundWinners.length !== 1) throw new RoundLedgerError(`expected exactly 1 round, got ${roundWinners.length}`)
  const w = roundWinners[0]
  if (!members.has(w.toLowerCase())) throw new RoundLedgerError(`round 1 winner ${w} not on roster`)
  return w
}

/** Hard gameplay cap (bible §1): no match runs past 60.0 server seconds of combat. */
export const ROUND_SECONDS = 60
/** Countdown before GO plus the result card after. */
export const TRANSITION_SECONDS = 15

/** Typical and worst-case match length in minutes (combat + countdown + result), for the pre-entry disclosure. */
export function matchLengthMinutes(_playerCount: number): { typical: number; worstCase: number } {
  return { typical: 1, worstCase: Math.ceil((ROUND_SECONDS + TRANSITION_SECONDS) / 60) }
}
