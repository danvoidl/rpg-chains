import type { Question as QuestionModel } from '@prisma/client';
import { QuestionSchema, type Question } from '@rpg-chains/shared-types';

/** Maps a database question row to the client-facing Question representation. */
export function toQuestion(row: QuestionModel): Question {
  const candidate =
    row.type === 'objective'
      ? {
          id: row.id,
          type: 'objective' as const,
          prompt: row.prompt,
          options: row.options,
          correctIndex: row.correctIndex,
        }
      : {
          id: row.id,
          type: 'open' as const,
          prompt: row.prompt,
        };
  return QuestionSchema.parse(candidate);
}
