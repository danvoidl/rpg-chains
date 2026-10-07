'use client';

import { useState } from 'react';
import { primaryButton, type TurnProps } from './turn-props';

/** The signal winner writes an answer to an open question; the master will judge it. */
export function OpenAnswerForm({
  view,
  act,
  pending,
}: Pick<TurnProps, 'view' | 'act' | 'pending'>) {
  const [text, setText] = useState('');
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim())
          act({ type: 'SubmitOpenAnswer', turnToken: view.turnToken, text: text.trim() });
      }}
    >
      <label className="block text-sm font-medium text-gray-900" htmlFor="open-answer">
        Sua resposta
      </label>
      <textarea
        id="open-answer"
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-md border border-gray-300 p-2 text-sm"
      />
      <button type="submit" className={primaryButton} disabled={pending || !text.trim()}>
        Enviar resposta
      </button>
    </form>
  );
}
