import { ActionPanel } from './action-panel';
import { AnswerPanel } from './answer-panel';
import { unitName } from './event-text';
import { SignalPanel } from './signal-panel';
import type { TurnProps } from './turn-props';

/** What the current stage asks of the viewer, or what they are waiting for. */
export function TurnPanel(props: TurnProps) {
  const { turn } = props.view;
  switch (turn.stage) {
    case 'awaiting_signal':
      return <SignalPanel {...props} question={turn.question} />;
    case 'awaiting_answer':
      return <AnswerPanel {...props} question={turn.question} profileId={turn.profileId} />;
    case 'awaiting_action':
      return <ActionPanel {...props} profileId={turn.profileId} />;
    case 'enemy':
      return (
        <p className="text-sm text-gray-700">Vez de {unitName(props.view, turn.instanceId)}…</p>
      );
    case 'awaiting_question':
      return <p className="text-sm text-gray-700">Aguardando o mestre escolher uma pergunta…</p>;
    case 'awaiting_judgement':
      return <p className="text-sm text-gray-700">Aguardando o julgamento do mestre…</p>;
    case 'paused':
      return <p className="text-sm text-gray-700">Batalha pausada: o mestre saiu.</p>;
    case 'starting':
    case 'ended':
      return null;
  }
}
