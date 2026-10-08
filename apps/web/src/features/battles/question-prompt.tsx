import type { PublicQuestion } from '@rpg-chains/shared-types';

/** The question of the turn, as everyone sees it. */
export function QuestionPrompt({ question }: { question: PublicQuestion }) {
  return <p className="text-lg font-medium text-gray-900">{question.prompt}</p>;
}
