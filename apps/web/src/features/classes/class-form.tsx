'use client';

import { useMemo } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { classWarnings, validateClass } from '@rpg-chains/campaign-rules';
import { MAX_SKILLS_PER_CLASS } from '@rpg-chains/game-config';
import {
  ClassInputSchema,
  type ClassInput,
  type DraftClass,
  type Item,
} from '@rpg-chains/shared-types';
import { ImageUpload } from '@/components/image-upload';
import { defaultEffect } from '@/features/effects/effect-defaults';
import { ClassFeedback } from './class-feedback';
import { classFormValues, formToDraftClass, type ClassFormValues } from './class-form-values';
import { SkillFields } from './skill-fields';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-sm text-red-600';

const BASE_FIELDS = [
  { name: 'baseHp', label: 'Vida base' },
  { name: 'baseEnergy', label: 'Energia base' },
  { name: 'hpPerLevel', label: 'Vida por nível' },
  { name: 'energyPerLevel', label: 'Energia por nível' },
  { name: 'maxSlots', label: 'Vagas por sala' },
] as const;

interface ClassFormProps {
  /** Prefill values when editing an existing class. */
  defaultValues?: DraftClass;
  /** Campaign items; equipment in the weapon slot can be the base weapon. */
  items: Item[];
  submitLabel: string;
  onSubmit: (values: ClassInput) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Class editor (spec §5): base stats, base weapon and up to four skills built from the effect
 * catalog. Runs the publish-gate rules live; saving with balancing warnings asks to confirm
 * (Fase 1b decision 2), while blocking issues still save — the draft tolerates them.
 */
export function ClassForm({
  defaultValues,
  items,
  submitLabel,
  onSubmit,
  isSubmitting,
}: ClassFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClassFormValues, unknown, ClassInput>({
    resolver: zodResolver(ClassInputSchema),
    defaultValues: classFormValues(defaultValues),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'skills' });

  const weapons = items.filter((item) => item.category === 'equipment' && item.slot === 'weapon');
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const values = watch();
  const draftClass = formToDraftClass(values, defaultValues?.id ?? 'new-class');
  const issues = validateClass(draftClass, 0, itemsById);
  const warnings = classWarnings(draftClass, 0);

  const submit = async (input: ClassInput) => {
    if (
      warnings.length > 0 &&
      !window.confirm(
        `Esta classe tem ${warnings.length} valor(es) fora das faixas recomendadas. Salvar mesmo assim?`,
      )
    ) {
      return;
    }
    await onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="class-name" className={labelClass}>
            Nome
          </label>
          <input id="class-name" type="text" {...register('name')} className={inputClass} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="class-weapon" className={labelClass}>
            Arma base
          </label>
          <select
            id="class-weapon"
            {...register('baseWeaponId', { setValueAs: (v: string | null) => v || null })}
            className={inputClass}
          >
            <option value="">— nenhuma —</option>
            {weapons.map((weapon) => (
              <option key={weapon.id} value={weapon.id}>
                {weapon.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="class-description" className={labelClass}>
            Descrição
          </label>
          <textarea
            id="class-description"
            rows={2}
            {...register('description')}
            className={inputClass}
          />
        </div>
      </div>

      <Controller
        control={control}
        name="artUrl"
        render={({ field }) => (
          <ImageUpload
            id="class-art"
            label="Arte"
            value={field.value ?? null}
            onChange={field.onChange}
          />
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {BASE_FIELDS.map(({ name, label }) => (
          <div key={name}>
            <label htmlFor={`class-${name}`} className={labelClass}>
              {label}
            </label>
            <input
              id={`class-${name}`}
              type="number"
              min={0}
              {...register(name, { valueAsNumber: true })}
              className={inputClass}
            />
            {errors[name] && <p className={errorClass}>{errors[name]?.message}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Habilidades ({fields.length}/{MAX_SKILLS_PER_CLASS})
        </p>
        {fields.map((field, index) => (
          <SkillFields
            key={field.id}
            index={index}
            control={control}
            register={register}
            setValue={setValue}
            onRemove={() => remove(index)}
          />
        ))}
        {errors.skills && <p className={errorClass}>Revise os campos das habilidades.</p>}
        {fields.length < MAX_SKILLS_PER_CLASS && (
          <button
            type="button"
            onClick={() =>
              append({
                name: '',
                text: '',
                iconUrl: null,
                energyCost: 15,
                cooldownRounds: 2,
                unlockLevel: 1,
                effect: defaultEffect('damage'),
              })
            }
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Adicionar habilidade
          </button>
        )}
      </div>

      <ClassFeedback issues={issues} warnings={warnings} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
