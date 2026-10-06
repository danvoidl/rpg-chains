'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Item, ItemInput } from '@rpg-chains/shared-types';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from '@/features/items/api';
import { ItemForm } from '@/features/items/item-form';
import { EFFECT_TYPE_LABELS, SLOT_LABELS } from '@/features/effects/effect-labels';

/** Items authoring page: list, create, edit and delete equipment and consumables. */
export default function ItemsPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { data: items, isLoading } = useItems(campaignId);
  const createItem = useCreateItem(campaignId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleCreate = async (values: ItemInput) => {
    await createItem.mutateAsync(values);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Itens</h1>

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : items && items.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {items.map((item) => (
            <ItemListItem
              key={item.id}
              item={item}
              campaignId={campaignId}
              isEditing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onDone={() => setEditingId(null)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nenhum item cadastrado ainda.</p>
      )}

      {editingId === null && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Novo item</h2>
          {createItem.isError && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              Erro ao criar item.
            </p>
          )}
          <ItemForm
            key={formKey}
            submitLabel="Criar item"
            onSubmit={handleCreate}
            isSubmitting={createItem.isPending}
          />
        </div>
      )}
    </div>
  );
}

/** One-line summary of an item for the list. */
function summary(item: Item): string {
  if (item.category === 'consumable') return `Consumível · ${EFFECT_TYPE_LABELS[item.effect.type]}`;
  const weapon = item.weapon
    ? ` · Dano ${item.weapon.baseDamage} ${item.weapon.weaponType === 'heavy' ? '(pesada)' : '(leve)'}`
    : '';
  return `${SLOT_LABELS[item.slot]}${weapon} · Defesa +${item.defenseBonus}`;
}

interface ItemListItemProps {
  item: Item;
  campaignId: string;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

/** Single item row with inline edit form and delete confirmation. */
function ItemListItem({ item, campaignId, isEditing, onEdit, onDone }: ItemListItemProps) {
  const updateItem = useUpdateItem(campaignId, item.id);
  const deleteItem = useDeleteItem(campaignId, item.id);

  const handleDelete = async () => {
    if (
      window.confirm(
        `Tem certeza de que deseja excluir "${item.name}"? Atenção: excluir um item que já está publicado será recusado ao republicar a campanha.`,
      )
    ) {
      await deleteItem.mutateAsync();
    }
  };

  const handleUpdate = async (values: ItemInput) => {
    await updateItem.mutateAsync(values);
    onDone();
  };

  if (isEditing) {
    return (
      <li className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900">Editando: {item.name}</p>
          <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:underline">
            Cancelar
          </button>
        </div>
        {updateItem.isError && (
          <p role="alert" className="text-sm text-red-700">
            Erro ao salvar item.
          </p>
        )}
        <ItemForm
          defaultValues={item}
          submitLabel="Salvar item"
          onSubmit={handleUpdate}
          isSubmitting={updateItem.isPending}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{item.name}</p>
        <p className="text-sm text-gray-500">{summary(item)}</p>
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
          disabled={deleteItem.isPending}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
    </li>
  );
}
