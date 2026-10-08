import type { NodeEntryRefusal } from '@rpg-chains/campaign-rules';

/** HTTP status for a node entry refusal (Fase 5, `checkNodeEntry`). */
export const NODE_ENTRY_STATUS = {
  node_not_found: 404,
  wrong_node_type: 422,
  node_locked: 409,
  node_cleared: 409,
} as const satisfies Record<NodeEntryRefusal, number>;
