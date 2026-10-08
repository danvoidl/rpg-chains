import { eligibleForSignal } from '@rpg-chains/battle-engine';
import type { PublicQuestion } from '@rpg-chains/shared-types';
import { QuestionPrompt } from './question-prompt';
import { primaryButton, type TurnProps } from './turn-props';

/** Why the viewer cannot tap, or null if they can. */
function blockedReason({ view, me }: TurnProps): string | null {
  if (!me) return 'Você está assistindo.';
  if (me.left) return 'Você saiu desta batalha.';
  if (me.downed) return 'Você está caído.';
  if (!eligibleForSignal(view).has(me.profileId)) {
    return 'Você agiu na rodada passada: espere a próxima.';
  }
  return null;
}

/** The signal race (spec §3.3): the question is shown and the first eligible tap answers it. */
export function SignalPanel(props: TurnProps & { question: PublicQuestion }) {
  const { view, act, pending, question } = props;
  const reason = blockedReason(props);
  return (
    <div className="space-y-4">
      <QuestionPrompt question={question} />
      {question.type === 'objective' && (
        <ul className="list-inside list-disc text-sm text-gray-700">
          {question.options.map((option, index) => (
            <li key={index}>{option}</li>
          ))}
        </ul>
      )}
      {reason ? (
        <p className="text-sm text-gray-600">{reason}</p>
      ) : (
        <button
          type="button"
          className={primaryButton}
          disabled={pending}
          onClick={() => act({ type: 'TapSignal', turnToken: view.turnToken })}
        >
          Tocar o sinal
        </button>
      )}
    </div>
  );
}
