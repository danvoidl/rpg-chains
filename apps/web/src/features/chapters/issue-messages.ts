import type { DraftIssue } from '@rpg-chains/campaign-rules';

/** Last field name of an issue path, e.g. `chapters[0].nodes[1].villainIds` -> `villainIds`. */
function lastField(path: string): string {
  return (
    path
      .split('.')
      .pop()
      ?.replace(/\[\d+\]$/, '') ?? ''
  );
}

/** Portuguese message for a draft issue, derived from its code (and path where needed). */
export function issueMessage(issue: DraftIssue): string {
  const field = lastField(issue.path);
  switch (issue.code) {
    case 'no_chapters':
      return 'A campanha precisa de pelo menos um capítulo pronto (fora de construção).';
    case 'entry_missing':
      return 'O capítulo não tem nó de entrada.';
    case 'boss_missing':
      return 'O capítulo não tem nó de chefe.';
    case 'boss_wrong_type':
      return 'O nó de chefe precisa ser do tipo Chefe.';
    case 'extra_boss':
      return 'Só o chefe do capítulo pode ser do tipo Chefe.';
    case 'unreachable_node':
      return 'Nó inalcançável a partir da entrada.';
    case 'cycle':
      return 'O grafo do capítulo tem um ciclo.';
    case 'battle_incomplete':
      if (field === 'recommendedLevel') return 'Defina o nível recomendado.';
      if (field === 'participantLimit') return 'Defina o limite de participantes.';
      return `Campo inválido (${issue.path}).`;
    case 'no_villains':
      return 'A batalha precisa de pelo menos um vilão.';
    case 'missing_reference':
      if (field === 'villainIds') return 'Vilão inexistente.';
      if (field === 'questionIds') return 'Pergunta inexistente.';
      if (field === 'itemIds') return 'Item inexistente.';
      if (field === 'prerequisites') return 'Pré-requisito aponta para um nó inexistente.';
      return `Campo inválido (${issue.path}).`;
    case 'open_question_on_branch':
      return 'Pergunta aberta só é permitida em nó de caminho único, não em ramificações paralelas.';
    case 'schema':
      if (field === 'attacks') return 'O vilão precisa de pelo menos um ataque.';
      if (field === 'mandatory') return 'O chefe precisa ser obrigatório.';
      if (field === 'name') return 'Nome obrigatório.';
      return `Campo inválido (${issue.path}).`;
  }
}
