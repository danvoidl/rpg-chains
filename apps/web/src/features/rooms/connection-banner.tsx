import { RECONNECT_GRACE_MS } from '@rpg-chains/game-config';

/** Shown while the tab's connection is down; Socket.IO keeps trying (spec §7). */
export function ConnectionBanner() {
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      Sem conexão — reconectando… Numa batalha, você tem {Math.round(RECONNECT_GRACE_MS / 1000)}{' '}
      segundos para voltar sem sair dela.
    </p>
  );
}
