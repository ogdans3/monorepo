import { z } from 'zod'

// A trade can go backwards. `countered` is why this is a state machine and not a
// boolean: a participant who proposes a different composition sends the whole
// trade back into negotiation rather than only ever forward to accepted.
export const TRADE_STATES = [
  // A trade exists from the first message, long before there is an offer.
  'talking',
  'pending',
  'countered',
  'accepted',
  // Everyone had accepted and someone asked to withdraw. Screen 08b.
  'paused',
  'completed',
  'cancelled',
] as const

export const tradeStateSchema = z.enum(TRADE_STATES)
export type TradeState = z.infer<typeof tradeStateSchema>

// Chains are capped at three participants. The many-way flow was cut in round 4,
// so a deeper cycle search would find matches no screen can show.
export const MAX_CHAIN_LENGTH = 3

// Each side of a hop is a list, not a single item.
export const MAX_ITEMS_PER_SIDE = 3

// The cash difference one side adds to balance the trade. We record it and never
// settle it: Swaply is not a party to the trade and moves no money. Stored in
// whole kroner because that is how the parties will say it out loud.
export const cashDifferenceSchema = z.object({
  payerParticipantIndex: z.number().int().min(0),
  amountNok: z.number().int().positive(),
})
export type CashDifference = z.infer<typeof cashDifferenceSchema>
