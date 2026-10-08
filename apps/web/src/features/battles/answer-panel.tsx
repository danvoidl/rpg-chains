import type { PublicQuestion } from '@rpg-chains/shared-types';
import { unitName } from './event-text';
import { OpenAnswerForm } from './open-answer-form';
import { QuestionPrompt } from './question-prompt';
import { optionButton, type TurnProps } from './turn-props';

/** The signal winner answers; everyone else watches the options. */
export function AnswerPanel(props: TurnProps & { question: PublicQuestion; profileId: string }) {
  const { view, me, act, pending, question, profileId } = props;
  const answering = me?.profileId === profileId;
  return (
    <div className="space-y-4">
      <QuestionPrompt question={question} />
      {!answering && (
        <p className="text-sm text-gray-600">{unitName(view, profileId)} está respondendo…</p>
      )}
      {question.type === 'objective' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => (
            <button
              key={index}
              type="button"
              className={optionButton}
              disabled={!answering || pending}
              onClick={() =>
                act({ type: 'SubmitObjectiveAnswer', turnToken: view.turnToken, index })
              }
            >
              {option}
            </button>
          ))}
        </div>
      ) : answering ? (
        <OpenAnswerForm view={view} act={act} pending={pending} />
      ) : null}
    </div>
  );
}
