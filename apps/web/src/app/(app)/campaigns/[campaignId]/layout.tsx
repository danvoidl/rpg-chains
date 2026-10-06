'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useCampaign } from '@/features/campaigns/api';

interface CampaignLayoutProps {
  children: ReactNode;
}

/** Layout for campaign detail view providing tabs for authoring sub-views. */
export default function CampaignLayout({ children }: CampaignLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const campaignId = params.campaignId as string;

  const { data: campaign, isLoading } = useCampaign(campaignId);

  const tabs = [
    {
      name: 'Visão geral',
      href: `/campaigns/${campaignId}`,
      isActive: pathname === `/campaigns/${campaignId}`,
    },
    {
      name: 'Capítulos',
      href: `/campaigns/${campaignId}/chapters`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/chapters`),
    },
    {
      name: 'Vilões',
      href: `/campaigns/${campaignId}/villains`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/villains`),
    },
    {
      name: 'Perguntas',
      href: `/campaigns/${campaignId}/questions`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/questions`),
    },
    {
      name: 'Classes',
      href: `/campaigns/${campaignId}/classes`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/classes`),
    },
    {
      name: 'Itens',
      href: `/campaigns/${campaignId}/items`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/items`),
    },
    {
      name: 'Publicar',
      href: `/campaigns/${campaignId}/publish`,
      isActive: pathname.startsWith(`/campaigns/${campaignId}/publish`),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {isLoading ? 'Carregando…' : (campaign?.name ?? '')}
        </h1>
      </div>

      <nav className="-mb-px flex space-x-8 border-b border-gray-200" aria-label="Tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              tab.isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            aria-current={tab.isActive ? 'page' : undefined}
          >
            {tab.name}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
