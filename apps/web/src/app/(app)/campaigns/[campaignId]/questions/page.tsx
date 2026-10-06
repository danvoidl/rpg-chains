'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Question, QuestionInput } from '@rpg-chains/shared-types';
import {
  useQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from '@/features/questions/api';
import { QuestionForm } from '@/features/questions/question-form';

type FilterType = 'all' | 'objective' | 'open';

/** Questions bank page: filter, list, create, edit, and delete campaign questions. */
export default function QuestionsPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [filter, setFilter] = useState<FilterType>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formKey, setFormKey] = useState(0);

  const { data: questions, isLoading } = useQuestions(
    campaignId,
    filter === 'all' ? undefined : filter,
  );

  const createQuestion = useCreateQuestion(campaignId);

  const handleCreate = async (values: QuestionInput) => {
    await createQuestion.mutateAsync(values);
    // Remount the form to clear it after a successful create.
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Banco de perguntas</h1>

      {/* Filter */}
      <div>
        <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700">
          Filtrar por tipo
        </label>
        <select
          id="filter-type"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as FilterType);
            setEditingQuestion(null);
          }}
          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Todas</option>
          <option value="objective">Objetivas</option>
          <option value="open">Abertas</option>
        </select>
      </div>

      {/* Question list */}
      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : questions && questions.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {questions.map((question) => (
              <QuestionListItem
                key={question.id}
                question={question}
                campaignId={campaignId}
                onEdit={() => setEditingQuestion(question)}
                isEditing={editingQuestion?.id === question.id}
                onEditSubmit={() => setEditingQuestion(null)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada ainda.</p>
        )}
      </div>

      {/* Create form */}
      {editingQuestion === null && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nova pergunta</h2>

          {createQuestion.isError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Erro ao criar pergunta.
            </div>
          )}

          <QuestionForm
            key={formKey}
            submitLabel="Criar pergunta"
            onSubmit={handleCreate}
            isSubmitting={createQuestion.isPending}
          />
        </div>
      )}
    </div>
  );
}

interface QuestionListItemProps {
  question: Question;
  campaignId: string;
  onEdit: () => void;
  isEditing: boolean;
  onEditSubmit: () => void;
}

/** Single question row with inline edit form and delete confirmation. */
function QuestionListItem({
  question,
  campaignId,
  onEdit,
  isEditing,
  onEditSubmit,
}: QuestionListItemProps) {
  const updateQuestion = useUpdateQuestion(campaignId, question.id);
  const deleteQuestion = useDeleteQuestion(campaignId, question.id);

  const handleDelete = async () => {
    if (window.confirm('Tem certeza de que deseja excluir esta pergunta?')) {
      await deleteQuestion.mutateAsync();
    }
  };

  const handleUpdate = async (values: QuestionInput) => {
    await updateQuestion.mutateAsync(values);
    onEditSubmit();
  };

  const typeBadge =
    question.type === 'objective' ? (
      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        Objetiva
      </span>
    ) : (
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Aberta
      </span>
    );

  return (
    <li className="p-4">
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">Editando pergunta</p>
            <button
              type="button"
              onClick={onEditSubmit}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          </div>

          {updateQuestion.isError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Erro ao salvar pergunta.
            </div>
          )}

          <QuestionForm
            defaultValues={question}
            submitLabel="Salvar pergunta"
            onSubmit={handleUpdate}
            isSubmitting={updateQuestion.isPending}
          />
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">{typeBadge}</div>
            <p className="text-sm text-gray-900">{question.prompt}</p>
            {question.type === 'objective' && (
              <p className="text-xs text-gray-500">
                Resposta correta: Alternativa {question.correctIndex + 1}
              </p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteQuestion.isPending}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
