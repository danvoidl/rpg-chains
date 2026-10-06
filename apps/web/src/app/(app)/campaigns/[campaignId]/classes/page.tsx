'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { ClassInput, DraftClass, Item } from '@rpg-chains/shared-types';
import {
  useClasses,
  useCreateClass,
  useDeleteClass,
  useImportKit,
  useUpdateClass,
} from '@/features/classes/api';
import { useItems } from '@/features/items/api';
import { ClassForm } from '@/features/classes/class-form';

/** Classes authoring page: list, import the default kit, create, edit and delete classes. */
export default function ClassesPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { data: classes, isLoading } = useClasses(campaignId);
  const { data: items = [] } = useItems(campaignId);
  const createClass = useCreateClass(campaignId);
  const importKit = useImportKit(campaignId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleCreate = async (values: ClassInput) => {
    await createClass.mutateAsync(values);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Classes</h1>
        <button
          type="button"
          onClick={() => importKit.mutate()}
          disabled={importKit.isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Importar kit padrão
        </button>
      </div>

      {importKit.isError && (
        <p role="alert" className="text-sm text-red-700">
          Erro ao importar o kit padrão.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : classes && classes.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {classes.map((cls) => (
            <ClassListItem
              key={cls.id}
              cls={cls}
              items={items}
              campaignId={campaignId}
              isEditing={editingId === cls.id}
              onEdit={() => setEditingId(cls.id)}
              onDone={() => setEditingId(null)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          Nenhuma classe ainda. Importe o kit padrão (Guardião, Penitente, Arauto e Sacerdote, com
          habilidades e armas base) ou crie a sua.
        </p>
      )}

      {editingId === null && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nova classe</h2>
          {createClass.isError && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              Erro ao criar classe.
            </p>
          )}
          <ClassForm
            key={formKey}
            items={items}
            submitLabel="Criar classe"
            onSubmit={handleCreate}
            isSubmitting={createClass.isPending}
          />
        </div>
      )}
    </div>
  );
}

interface ClassListItemProps {
  cls: DraftClass;
  items: Item[];
  campaignId: string;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

/** Single class row with inline edit form and delete confirmation. */
function ClassListItem({ cls, items, campaignId, isEditing, onEdit, onDone }: ClassListItemProps) {
  const updateClass = useUpdateClass(campaignId, cls.id);
  const deleteClass = useDeleteClass(campaignId, cls.id);
  const weapon = items.find((item) => item.id === cls.baseWeaponId);

  const handleDelete = async () => {
    if (
      window.confirm(
        `Tem certeza de que deseja excluir "${cls.name}"? Atenção: excluir uma classe que já está publicada será recusado ao republicar a campanha.`,
      )
    ) {
      await deleteClass.mutateAsync();
    }
  };

  const handleUpdate = async (values: ClassInput) => {
    await updateClass.mutateAsync(values);
    onDone();
  };

  if (isEditing) {
    return (
      <li className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900">Editando: {cls.name}</p>
          <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:underline">
            Cancelar
          </button>
        </div>
        {updateClass.isError && (
          <p role="alert" className="text-sm text-red-700">
            Erro ao salvar classe.
          </p>
        )}
        <ClassForm
          defaultValues={cls}
          items={items}
          submitLabel="Salvar classe"
          onSubmit={handleUpdate}
          isSubmitting={updateClass.isPending}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 p-4">
      {cls.artUrl && (
        <img
          src={cls.artUrl}
          alt={cls.name}
          className="h-12 w-12 rounded-md border border-gray-200 object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{cls.name}</p>
        <p className="text-sm text-gray-500">
          Vida {cls.baseHp} · Energia {cls.baseEnergy} · Vagas {cls.maxSlots} · Arma:{' '}
          {weapon?.name ?? 'nenhuma'} · Habilidades: {cls.skills.length}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
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
          disabled={deleteClass.isPending}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
    </li>
  );
}
