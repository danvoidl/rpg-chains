import type { PublicQuestion } from '@rpg-chains/shared-types';
import { unitName } from './event-text';
import { QuestionPrompt } from './question-prompt';
import { primaryButton, type TurnProps } from './turn-props';

/** An open answer waiting for the master: he approves or fails it; the others wait (spec §3.2). */
export function JudgementPanel(
  props: TurnProps & { question: PublicQuestion; profileId: string; answer: string },
) {
  const { view, act, pending, isMaster, question, profileId, answer } = props;
  const judge = (approved: boolean) =>
    act({ type: 'JudgeOpenAnswer', turnToken: view.turnToken, approved });
  return (
    <div className="space-y-3">
      <QuestionPrompt question={question} />
      <blockquote className="rounded-md border-l-4 border-indigo-300 bg-indigo-50 p-3 text-sm text-gray-900">
        <span className="font-medium">{unitName(view, profileId)}:</span> {answer}
      </blockquote>
      {isMaster ? (
        <div className="flex gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={pending}
            onClick={() => judge(true)}
          >
            Aprovar
          </button>
          <button
            type="button"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            disabled={pending}
            onClick={() => judge(false)}
          >
            Reprovar
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Aguardando o julgamento do mestre…</p>
      )}
    </div>
  );
}
