'use client';

import {
  Controller,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import type { Effect } from '@rpg-chains/shared-types';
import { ImageUpload } from '@/components/image-upload';
import { EffectFields } from '@/features/effects/effect-fields';
import type { ClassFormValues } from './class-form-values';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';

interface SkillFieldsProps {
  index: number;
  control: Control<ClassFormValues>;
  register: UseFormRegister<ClassFormValues>;
  setValue: UseFormSetValue<ClassFormValues>;
  onRemove: () => void;
}

/** One skill of the class form (spec §5.3): cosmetic shell, gameplay envelope and its effect. */
export function SkillFields({ index, control, register, setValue, onRemove }: SkillFieldsProps) {
  const prefix = `skill-${index}`;
  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
      {/* Keeps the skill id across saves — the compatibility gate compares skills by id. */}
      <input
        type="hidden"
        {...register(`skills.${index}.id`, { setValueAs: (v: string) => v || undefined })}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Habilidade {index + 1}</p>
        <button type="button" onClick={onRemove} className="text-sm text-red-600 hover:underline">
          Remover habilidade
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <label htmlFor={`${prefix}-name`} className={labelClass}>
            Nome da habilidade
          </label>
          <input
            id={`${prefix}-name`}
            type="text"
            {...register(`skills.${index}.name`)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-cost`} className={labelClass}>
            Custo de energia
          </label>
          <input
            id={`${prefix}-cost`}
            type="number"
            min={0}
            {...register(`skills.${index}.energyCost`, { valueAsNumber: true })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-cooldown`} className={labelClass}>
            Recarga (rodadas)
          </label>
          <input
            id={`${prefix}-cooldown`}
            type="number"
            min={0}
            {...register(`skills.${index}.cooldownRounds`, { valueAsNumber: true })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-unlock`} className={labelClass}>
            Nível de desbloqueio
          </label>
          <input
            id={`${prefix}-unlock`}
            type="number"
            min={1}
            {...register(`skills.${index}.unlockLevel`, { valueAsNumber: true })}
            className={inputClass}
          />
        </div>
        <div className="col-span-3">
          <label htmlFor={`${prefix}-text`} className={labelClass}>
            Texto de exibição
          </label>
          <input
            id={`${prefix}-text`}
            type="text"
            {...register(`skills.${index}.text`)}
            className={inputClass}
          />
        </div>
      </div>

      <Controller
        control={control}
        name={`skills.${index}.iconUrl`}
        render={({ field }) => (
          <ImageUpload
            id={`${prefix}-icon`}
            label="Ícone"
            value={field.value ?? null}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name={`skills.${index}.effect`}
        render={({ field }) => (
          <EffectFields
            id={`${prefix}-effect`}
            // Effects here come from `defaultEffect` or a parsed skill, so `base` is always set.
            value={field.value as Effect}
            // Not `field.onChange`: RHF reads any object with a `target` key as a DOM event, and
            // every effect has one — it would store `'self'.value`, i.e. undefined.
            onChange={(effect) => setValue(`skills.${index}.effect`, effect, { shouldDirty: true })}
          />
        )}
      />
    </div>
  );
}
