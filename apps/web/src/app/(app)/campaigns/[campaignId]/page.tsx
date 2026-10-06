'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CampaignInputSchema, type CampaignInput } from '@rpg-chains/shared-types';
import { useCampaign, useUpdateCampaign, useDeleteCampaign } from '@/features/campaigns/api';

/** Campaign overview page for editing campaign metadata or deleting the campaign. */
export default function CampaignOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const { data: campaign, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign(campaignId);
  const deleteCampaign = useDeleteCampaign(campaignId);

  const [isSaved, setIsSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CampaignInput>({
    resolver: zodResolver(CampaignInputSchema),
    values: campaign
      ? {
          name: campaign.name,
          description: campaign.description ?? '',
        }
      : undefined,
  });

  const onSubmit = async (values: CampaignInput) => {
    setIsSaved(false);
    await updateCampaign.mutateAsync(values);
    setIsSaved(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza de que deseja excluir esta campanha?')) {
      await deleteCampaign.mutateAsync();
      router.push('/campaigns');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Carregando…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Editar campanha</h2>

        {updateCampaign.isError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            Erro ao atualizar campanha.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              id="name"
              type="text"
              {...register('name', { onChange: () => setIsSaved(false) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Descrição
            </label>
            <textarea
              id="description"
              rows={3}
              {...register('description', { onChange: () => setIsSaved(false) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={isSubmitting || updateCampaign.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Salvar
            </button>

            {isSaved && (
              <span role="status" className="text-sm font-medium text-green-600">
                Salvo
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Zona de perigo</h2>
        <p className="mt-1 text-sm text-red-700">
          Ao excluir a campanha, todos os dados associados serão removidos permanentemente.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteCampaign.isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Excluir campanha
          </button>
        </div>
      </div>
    </div>
  );
}
