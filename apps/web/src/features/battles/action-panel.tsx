import { unitName } from './event-text';
import { optionButton, type TurnProps } from './turn-props';

/** After a right answer, the answerer picks the group's action (spec §3.4). */
export function ActionPanel(props: TurnProps & { profileId: string }) {
  const { view, me, act, pending, profileId } = props;
  if (me?.profileId !== profileId) {
    return (
      <p className="text-sm text-gray-600">{unitName(view, profileId)} está escolhendo a ação…</p>
    );
  }
  const targets = view.enemies.filter((e) => e.currentHp > 0);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-900">Você acertou! Escolha o alvo do ataque:</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {targets.map((enemy) => (
          <button
            key={enemy.instanceId}
            type="button"
            className={optionButton}
            disabled={pending}
            onClick={() =>
              act({
                type: 'ChooseAction',
                turnToken: view.turnToken,
                action: { type: 'attack', targetInstanceId: enemy.instanceId },
              })
            }
          >
            Atacar {enemy.name}
          </button>
        ))}
      </div>
      {/* Skills and consumables arrive with the effect catalog (Fase 3 plan M6). */}
      <p className="text-xs text-gray-500">Habilidades e itens chegam em breve.</p>
    </div>
  );
}
