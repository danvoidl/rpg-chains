/** Asks the master to confirm closing the room; true when they agree. */
export function confirmCloseRoom(): boolean {
  return window.confirm('Encerrar a sala? Ninguém mais poderá jogar nela.');
}
