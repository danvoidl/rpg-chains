'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { VillainInputSchema, type VillainInput, type DraftVillain } from '@rpg-chains/shared-types';
import { ImageUpload } from '@/components/image-upload';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-sm text-red-600';

interface VillainFormProps {
  /** Prefill values when editing an existing villain. */
  defaultValues?: DraftVillain;
  submitLabel: string;
  onSubmit: (values: VillainInput) => Promise<void>;
  isSubmitting: boolean;
}

/** react-hook-form villain editor with dynamic attack rows and image upload. */
export function VillainForm({
  defaultValues,
  submitLabel,
  onSubmit,
  isSubmitting,
}: VillainFormProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<VillainInput>({
    resolver: zodResolver(VillainInputSchema),
    defaultValues: defaultValues
      ? {
          name: defaultValues.name,
          imageUrl: defaultValues.imageUrl ?? null,
          hp: defaultValues.hp,
          strength: defaultValues.strength,
          dexterity: defaultValues.dexterity,
          intelligence: defaultValues.intelligence,
          defense: defaultValues.defense,
          attacks: defaultValues.attacks,
        }
      : {
          name: '',
          imageUrl: null,
          hp: 1,
          strength: 0,
          dexterity: 0,
          intelligence: 0,
          defense: 0,
          attacks: [],
        },
  });

  // Sync form values when defaultValues changes (switching to a different villain to edit).
  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        imageUrl: defaultValues.imageUrl ?? null,
        hp: defaultValues.hp,
        strength: defaultValues.strength,
        dexterity: defaultValues.dexterity,
        intelligence: defaultValues.intelligence,
        defense: defaultValues.defense,
        attacks: defaultValues.attacks,
      });
    }
  }, [defaultValues, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: 'attacks' });

  const handleAddAttack = () => {
    append({ name: '', baseDamage: 0, targetType: 'single', cooldownRounds: 0 });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="villain-name" className={labelClass}>
          Nome
        </label>
        <input id="villain-name" type="text" {...register('name')} className={inputClass} />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      {/* Image */}
      <Controller
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <ImageUpload
            id="villain-image"
            label="Imagem"
            value={field.value ?? null}
            onChange={(url) => field.onChange(url)}
          />
        )}
      />
      {errors.imageUrl && <p className={errorClass}>{errors.imageUrl.message}</p>}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="villain-hp" className={labelClass}>
            Vida
          </label>
          <input
            id="villain-hp"
            type="number"
            min={1}
            {...register('hp', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.hp && <p className={errorClass}>{errors.hp.message}</p>}
        </div>

        <div>
          <label htmlFor="villain-strength" className={labelClass}>
            Força
          </label>
          <input
            id="villain-strength"
            type="number"
            min={0}
            {...register('strength', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.strength && <p className={errorClass}>{errors.strength.message}</p>}
        </div>

        <div>
          <label htmlFor="villain-dexterity" className={labelClass}>
            Destreza
          </label>
          <input
            id="villain-dexterity"
            type="number"
            min={0}
            {...register('dexterity', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.dexterity && <p className={errorClass}>{errors.dexterity.message}</p>}
        </div>

        <div>
          <label htmlFor="villain-intelligence" className={labelClass}>
            Inteligência
          </label>
          <input
            id="villain-intelligence"
            type="number"
            min={0}
            {...register('intelligence', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.intelligence && <p className={errorClass}>{errors.intelligence.message}</p>}
        </div>

        <div>
          <label htmlFor="villain-defense" className={labelClass}>
            Defesa
          </label>
          <input
            id="villain-defense"
            type="number"
            min={0}
            {...register('defense', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.defense && <p className={errorClass}>{errors.defense.message}</p>}
        </div>
      </div>

      {/* Attacks */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Ataques</p>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3"
          >
            {/* Preserve existing attack id in hidden state */}
            <input
              type="hidden"
              {...register(`attacks.${index}.id`, { setValueAs: (v: string) => v || undefined })}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <label htmlFor={`attack-name-${index}`} className={labelClass}>
                  Nome do ataque
                </label>
                <input
                  id={`attack-name-${index}`}
                  type="text"
                  {...register(`attacks.${index}.name`)}
                  className={inputClass}
                />
                {errors.attacks?.[index]?.name && (
                  <p className={errorClass}>{errors.attacks[index].name?.message}</p>
                )}
              </div>

              <div>
                <label htmlFor={`attack-damage-${index}`} className={labelClass}>
                  Dano base
                </label>
                <input
                  id={`attack-damage-${index}`}
                  type="number"
                  min={0}
                  {...register(`attacks.${index}.baseDamage`, { valueAsNumber: true })}
                  className={inputClass}
                />
                {errors.attacks?.[index]?.baseDamage && (
                  <p className={errorClass}>{errors.attacks[index].baseDamage?.message}</p>
                )}
              </div>

              <div>
                <label htmlFor={`attack-cooldown-${index}`} className={labelClass}>
                  Recarga (rodadas)
                </label>
                <input
                  id={`attack-cooldown-${index}`}
                  type="number"
                  min={0}
                  {...register(`attacks.${index}.cooldownRounds`, { valueAsNumber: true })}
                  className={inputClass}
                />
                {errors.attacks?.[index]?.cooldownRounds && (
                  <p className={errorClass}>{errors.attacks[index].cooldownRounds?.message}</p>
                )}
              </div>

              <div>
                <label htmlFor={`attack-target-${index}`} className={labelClass}>
                  Alvo
                </label>
                <select
                  id={`attack-target-${index}`}
                  {...register(`attacks.${index}.targetType`)}
                  className={inputClass}
                >
                  <option value="single">Único</option>
                  <option value="area">Área</option>
                </select>
                {errors.attacks?.[index]?.targetType && (
                  <p className={errorClass}>{errors.attacks[index].targetType?.message}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className="text-sm text-red-600 hover:underline"
            >
              Remover ataque
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddAttack}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Adicionar ataque
        </button>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
