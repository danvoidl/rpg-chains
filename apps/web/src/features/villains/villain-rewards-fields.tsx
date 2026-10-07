'use client';

import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { DROP_CHANCE_TIERS, MAX_DROP_CHANCE, type DropChanceTier } from '@rpg-chains/game-config';
import type { Item, VillainInput } from '@rpg-chains/shared-types';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-sm text-red-600';

const TIER_LABELS: Record<DropChanceTier, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
};
const TIERS = Object.keys(DROP_CHANCE_TIERS) as DropChanceTier[];

/** Fraction of 1 ↔ percentage shown in the field, to one decimal (3% and 0.5% both fit). */
const toPercent = (chance: number) => Math.round(chance * 1000) / 10;

/** The tier whose preset the chance matches, or `custom` after fine-tuning. */
function tierOf(chance: number | undefined): DropChanceTier | 'custom' {
  return TIERS.find((tier) => DROP_CHANCE_TIERS[tier] === chance) ?? 'custom';
}

interface VillainRewardsFieldsProps {
  control: Control<VillainInput>;
  register: UseFormRegister<VillainInput>;
  setValue: UseFormSetValue<VillainInput>;
  errors: FieldErrors<VillainInput>;
  /** The campaign's items a drop may point at. */
  items: Item[];
}

/**
 * What defeating the villain is worth (spec §6): XP and gold per instance, and a drop table where
 * each item picks a rarity tier (or a fine-tuned chance up to the cap). No drop is ever certain.
 */
export function VillainRewardsFields({
  control,
  register,
  setValue,
  errors,
  items,
}: VillainRewardsFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'drops' });
  const drops = useWatch({ control, name: 'drops' }) ?? [];

  const handleAddDrop = () => {
    const first = items[0];
    if (first) append({ itemId: first.id, chance: DROP_CHANCE_TIERS.common });
  };

  return (
    <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
      <legend className="px-1 text-sm font-medium text-gray-700">Recompensas</legend>
      <p className="text-xs text-gray-500">
        Por vilão derrotado, para cada participante, antes do fator de relevância.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="villain-xp" className={labelClass}>
            Experiência
          </label>
          <input
            id="villain-xp"
            type="number"
            min={0}
            {...register('xpReward', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.xpReward && <p className={errorClass}>{errors.xpReward.message}</p>}
        </div>
        <div>
          <label htmlFor="villain-gold" className={labelClass}>
            Ouro
          </label>
          <input
            id="villain-gold"
            type="number"
            min={0}
            {...register('goldReward', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.goldReward && <p className={errorClass}>{errors.goldReward.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Itens que podem cair</p>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor={`drop-item-${index}`} className={labelClass}>
                Item
              </label>
              <select
                id={`drop-item-${index}`}
                {...register(`drops.${index}.itemId`)}
                className={inputClass}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`drop-tier-${index}`} className={labelClass}>
                Raridade
              </label>
              <select
                id={`drop-tier-${index}`}
                value={tierOf(drops[index]?.chance)}
                onChange={(e) => {
                  const tier = e.target.value as DropChanceTier | 'custom';
                  if (tier !== 'custom') {
                    setValue(`drops.${index}.chance`, DROP_CHANCE_TIERS[tier], {
                      shouldDirty: true,
                    });
                  }
                }}
                className={inputClass}
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIER_LABELS[tier]} ({toPercent(DROP_CHANCE_TIERS[tier])}%)
                  </option>
                ))}
                <option value="custom">Personalizada</option>
              </select>
            </div>
            <Controller
              control={control}
              name={`drops.${index}.chance`}
              render={({ field: chance }) => (
                <div>
                  <label htmlFor={`drop-chance-${index}`} className={labelClass}>
                    Chance (%)
                  </label>
                  <input
                    id={`drop-chance-${index}`}
                    type="number"
                    min={0.1}
                    max={toPercent(MAX_DROP_CHANCE)}
                    step={0.1}
                    value={toPercent(chance.value ?? 0)}
                    onChange={(e) => chance.onChange(Number(e.target.value) / 100)}
                    className={inputClass}
                  />
                </div>
              )}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="pb-2 text-left text-sm text-red-600 hover:underline"
            >
              Remover
            </button>
            {errors.drops?.[index]?.chance && (
              <p className={`${errorClass} col-span-full`}>
                A chance vai de 0,1% a {toPercent(MAX_DROP_CHANCE)}%.
              </p>
            )}
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-xs text-gray-500">
            Cadastre itens na campanha para usá-los como drop.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleAddDrop}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Adicionar drop
          </button>
        )}
      </div>
    </fieldset>
  );
}
