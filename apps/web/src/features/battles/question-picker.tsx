'use client';

import { useState } from 'react';
import { useQuestionBank } from './api';
import { optionButton, primaryButton, type TurnProps } from './turn-props';

/**
 * The master opens the group's turn (spec §3.2): one of the node's open questions, one written on
 * the spot (it stays in this battle only), or an objective one drawn by the system.
 */
export function QuestionPicker({ view, act, pending, battleId }: TurnProps) {
  const bank = useQuestionBank(battleId, true);
  const [prompt, setPrompt] = useState('');
  const present = (question: { questionId: string } | { prompt: string } | { draw: 'objective' }) =>
    act({ type: 'PresentQuestion', turnToken: view.turnToken, question });
  const open = bank.data?.filter((q) => q.type === 'open') ?? [];
  const hasObjective = bank.data?.some((q) => q.type === 'objective') ?? false;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-900">Escolha a pergunta deste turno.</p>
      {bank.isLoading && <p className="text-sm text-gray-500">Carregando perguntas…</p>}
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((question) => (
            <button
              key={question.questionId}
              type="button"
              className={optionButton}
              disabled={pending}
              onClick={() => question.questionId && present({ questionId: question.questionId })}
            >
              {question.prompt}
            </button>
          ))}
        </div>
      )}
      {hasObjective && (
        <button
          type="button"
          className={optionButton}
          disabled={pending}
          onClick={() => present({ draw: 'objective' })}
        >
          Sortear uma pergunta objetiva
        </button>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) present({ prompt: prompt.trim() });
        }}
      >
        <label className="block text-sm font-medium text-gray-900" htmlFor="ad-hoc-question">
          Ou escreva uma pergunta agora
        </label>
        <textarea
          id="ad-hoc-question"
          rows={2}
          maxLength={2000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="w-full rounded-md border border-gray-300 p-2 text-sm"
        />
        <button type="submit" className={primaryButton} disabled={pending || !prompt.trim()}>
          Exibir pergunta
        </button>
      </form>
    </div>
  );
}
