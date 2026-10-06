'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CampaignInputSchema, type CampaignInput } from '@rpg-chains/shared-types';
import { useCampaigns, useCreateCampaign } from '@/features/campaigns/api';

/** Campaigns dashboard listing existing campaigns and providing a creation form. */
export default function CampaignsPage() {
  const router = useRouter();
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CampaignInput>({
    resolver: zodResolver(CampaignInputSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (values: CampaignInput) => {
    const newCampaign = await createCampaign.mutateAsync(values);
    router.push(`/campaigns/${newCampaign.id}`);
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Minhas campanhas</h1>
        <div className="mt-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Carregando…</p>
          ) : campaigns && campaigns.length > 0 ? (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="p-4 hover:bg-gray-50">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="text-base font-semibold text-blue-600 hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  {campaign.description && (
                    <p className="mt-1 text-sm text-gray-500">{campaign.description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma campanha ainda.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Criar nova campanha</h2>

        {createCampaign.isError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            Erro ao criar campanha.
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
              {...register('name')}
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
              {...register('description')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || createCampaign.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Criar campanha
          </button>
        </form>
      </div>
    </div>
  );
}
