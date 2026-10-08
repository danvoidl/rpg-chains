'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { DraftVillain, Item, VillainInput } from '@rpg-chains/shared-types';
import {
  useVillains,
  useCreateVillain,
  useUpdateVillain,
  useDeleteVillain,
} from '@/features/villains/api';
import { useItems } from '@/features/items/api';
import { VillainForm } from '@/features/villains/villain-form';

/** Villains authoring page: list, create, edit, and delete campaign villains. */
export default function VillainsPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { data: villains, isLoading } = useVillains(campaignId);
  const items = useItems(campaignId).data ?? [];
  const createVillain = useCreateVillain(campaignId);

  const [editingVillain, setEditingVillain] = useState<DraftVillain | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleCreate = async (values: VillainInput) => {
    await createVillain.mutateAsync(values);
    // Remount the form to clear it after a successful create.
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vilões</h1>

      {/* Villain list */}
      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : villains && villains.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {villains.map((villain) => (
              <VillainListItem
                key={villain.id}
                villain={villain}
                campaignId={campaignId}
                items={items}
                onEdit={() => setEditingVillain(villain)}
                isEditing={editingVillain?.id === villain.id}
                onEditSubmit={() => setEditingVillain(null)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nenhum vilão cadastrado ainda.</p>
        )}
      </div>

      {/* Create form */}
      {editingVillain === null && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Novo vilão</h2>

          {createVillain.isError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Erro ao criar vilão.
            </div>
          )}

          <VillainForm
            key={formKey}
            items={items}
            submitLabel="Criar vilão"
            onSubmit={handleCreate}
            isSubmitting={createVillain.isPending}
          />
        </div>
      )}
    </div>
  );
}

interface VillainListItemProps {
  villain: DraftVillain;
  campaignId: string;
  items: Item[];
  onEdit: () => void;
  isEditing: boolean;
  onEditSubmit: () => void;
}

/** Single villain row with inline edit form and delete confirmation. */
function VillainListItem({
  villain,
  campaignId,
  items,
  onEdit,
  isEditing,
  onEditSubmit,
}: VillainListItemProps) {
  const updateVillain = useUpdateVillain(campaignId, villain.id);
  const deleteVillain = useDeleteVillain(campaignId, villain.id);

  const handleDelete = async () => {
    if (
      window.confirm(
        `Tem certeza de que deseja excluir "${villain.name}"? Atenção: excluir um vilão que já está publicado será recusado ao republicar a campanha.`,
      )
    ) {
      await deleteVillain.mutateAsync();
    }
  };

  const handleUpdate = async (values: VillainInput) => {
    await updateVillain.mutateAsync(values);
    onEditSubmit();
  };

  return (
    <li className="p-4">
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">Editando: {villain.name}</p>
            <button
              type="button"
              onClick={onEditSubmit}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          </div>

          {updateVillain.isError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Erro ao salvar vilão.
            </div>
          )}

          <VillainForm
            defaultValues={villain}
            items={items}
            submitLabel="Salvar vilão"
            onSubmit={handleUpdate}
            isSubmitting={updateVillain.isPending}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {villain.imageUrl && (
            <img
              src={villain.imageUrl}
              alt={villain.name}
              className="h-12 w-12 rounded-md border border-gray-200 object-cover"
            />
          )}

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{villain.name}</p>
            <p className="text-sm text-gray-500">
              PV: {villain.hp} · Ataques: {villain.attacks.length}
            </p>
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
              disabled={deleteVillain.isPending}
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
