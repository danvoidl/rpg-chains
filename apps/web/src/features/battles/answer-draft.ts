/**
 * The open answer being typed, kept per battle and turn in `sessionStorage` so a reload inside
 * the reconnection grace does not lose it (Fase 6 plan decision 10). Storage may be unavailable
 * (private mode, blocked site data): then the draft just lives in memory.
 */
const keyOf = (battleId: string, turnToken: number) => `answer-draft:${battleId}:${turnToken}`;

export function readAnswerDraft(battleId: string, turnToken: number): string {
  try {
    return sessionStorage.getItem(keyOf(battleId, turnToken)) ?? '';
  } catch {
    return '';
  }
}

export function writeAnswerDraft(battleId: string, turnToken: number, text: string): void {
  try {
    if (text) sessionStorage.setItem(keyOf(battleId, turnToken), text);
    else sessionStorage.removeItem(keyOf(battleId, turnToken));
  } catch {
    // Memory only.
  }
}
