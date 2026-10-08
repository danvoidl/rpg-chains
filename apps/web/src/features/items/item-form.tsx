'use client';

import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AttributeSchema,
  ItemInputSchema,
  SlotSchema,
  type Item,
  type Effect,
  type ItemInput,
  type Slot,
} from '@rpg-chains/shared-types';
import { EffectFields } from '@/features/effects/effect-fields';
import { defaultEffect } from '@/features/effects/effect-defaults';
import { ATTRIBUTE_LABELS, SLOT_LABELS } from '@/features/effects/effect-labels';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-sm text-red-600';

const DEFAULT_WEAPON = {
  weaponType: 'light',
  baseDamage: 10,
  scalingAttribute: 'dexterity',
  scale: 1,
} as const;

/** Form state before the schema fills its defaults (`requirements`, `defenseBonus`). */
type ItemFormValues = z.input<typeof ItemInputSchema>;

/** Empty field → undefined, so an unset requirement stays absent instead of NaN. */
const optionalNumber = (raw: string) => (raw === '' ? undefined : Number(raw));

function initialValues(item?: Item): ItemFormValues {
  if (!item) {
    return {
      category: 'equipment',
      name: '',
      price: 0,
      slot: 'weapon',
      requirements: {},
      defenseBonus: 0,
      weapon: { ...DEFAULT_WEAPON },
    };
  }
  const { id: _id, ...rest } = item;
  return rest;
}

interface ItemFormProps {
  defaultValues?: Item;
  submitLabel: string;
  onSubmit: (values: ItemInput) => Promise<void>;
  isSubmitting: boolean;
}

/** Item editor: equipment (slot, requirements, defense, weapon stats) or consumable (effect). */
export function ItemForm({ defaultValues, submitLabel, onSubmit, isSubmitting }: ItemFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ItemFormValues, unknown, ItemInput>({
    resolver: zodResolver(ItemInputSchema),
    defaultValues: initialValues(defaultValues),
  });

  const category = watch('category');
  const slot = watch('slot');
  // Errors of the equipment-only fields; the union hides them on the consumable variant.
  const equipmentErrors = errors as Partial<
    Record<'weapon' | 'defenseBonus', { message?: string }>
  >;

  const changeCategory = (next: ItemInput['category']) => {
    const [name, price] = getValues(['name', 'price']);
    reset(
      next === 'consumable'
        ? { category: 'consumable', name, price, effect: defaultEffect('heal') }
        : { ...initialValues(), name, price },
    );
  };

  const changeSlot = (next: string) => {
    setValue('slot', next as Slot);
    // Weapon stats exist exactly on the weapon slot.
    setValue('weapon', next === 'weapon' ? { ...DEFAULT_WEAPON } : undefined);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="item-name" className={labelClass}>
            Nome
          </label>
          <input id="item-name" type="text" {...register('name')} className={inputClass} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="item-category" className={labelClass}>
            Categoria
          </label>
          <select
            id="item-category"
            value={category}
            onChange={(e) => changeCategory(e.target.value as ItemInput['category'])}
            className={inputClass}
          >
            <option value="equipment">Equipamento</option>
            <option value="consumable">Consumível</option>
          </select>
        </div>
        <div>
          <label htmlFor="item-price" className={labelClass}>
            Preço (ouro)
          </label>
          <input
            id="item-price"
            type="number"
            min={0}
            {...register('price', { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.price && <p className={errorClass}>{errors.price.message}</p>}
        </div>
      </div>

      {category === 'equipment' ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <label htmlFor="item-slot" className={labelClass}>
                Slot
              </label>
              <select
                id="item-slot"
                value={slot}
                onChange={(e) => changeSlot(e.target.value)}
                className={inputClass}
              >
                {SlotSchema.options.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item-defense" className={labelClass}>
                Bônus de defesa
              </label>
              <input
                id="item-defense"
                type="number"
                min={0}
                {...register('defenseBonus', { valueAsNumber: true })}
                className={inputClass}
              />
              {equipmentErrors.defenseBonus && (
                <p className={errorClass}>{equipmentErrors.defenseBonus.message}</p>
              )}
            </div>
            {AttributeSchema.options.map((attribute) => (
              <div key={attribute}>
                <label htmlFor={`item-req-${attribute}`} className={labelClass}>
                  Req. {ATTRIBUTE_LABELS[attribute]}
                </label>
                <input
                  id={`item-req-${attribute}`}
                  type="number"
                  min={0}
                  {...register(`requirements.${attribute}`, { setValueAs: optionalNumber })}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          {slot === 'weapon' && (
            <fieldset className="grid grid-cols-2 gap-4 rounded-md border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4">
              <legend className="px-1 text-sm font-medium text-gray-700">Arma</legend>
              <div>
                <label htmlFor="weapon-type" className={labelClass}>
                  Tipo
                </label>
                <select id="weapon-type" {...register('weapon.weaponType')} className={inputClass}>
                  <option value="light">Leve</option>
                  <option value="heavy">Pesada</option>
                </select>
              </div>
              <div>
                <label htmlFor="weapon-damage" className={labelClass}>
                  Dano base
                </label>
                <input
                  id="weapon-damage"
                  type="number"
                  min={0}
                  {...register('weapon.baseDamage', { valueAsNumber: true })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="weapon-attribute" className={labelClass}>
                  Atributo de escala
                </label>
                <select
                  id="weapon-attribute"
                  {...register('weapon.scalingAttribute')}
                  className={inputClass}
                >
                  {AttributeSchema.options.map((attribute) => (
                    <option key={attribute} value={attribute}>
                      {ATTRIBUTE_LABELS[attribute]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="weapon-scale" className={labelClass}>
                  Escala (×)
                </label>
                <input
                  id="weapon-scale"
                  type="number"
                  min={0}
                  step={0.1}
                  {...register('weapon.scale', { valueAsNumber: true })}
                  className={inputClass}
                />
              </div>
              {equipmentErrors.weapon && (
                <p className={`${errorClass} col-span-full`}>
                  {equipmentErrors.weapon.message ?? 'Atributos da arma inválidos.'}
                </p>
              )}
            </fieldset>
          )}
        </>
      ) : (
        <Controller
          control={control}
          name="effect"
          render={({ field, fieldState }) => (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <EffectFields
                id="item-effect"
                // Effects here always come from `defaultEffect` or a parsed item, so `base` is set.
                value={field.value as Effect}
                // Not `field.onChange`: RHF reads any object with a `target` key as a DOM event,
                // and every effect has one — it would store `'self'.value`, i.e. undefined.
                onChange={(effect) => setValue('effect', effect, { shouldDirty: true })}
              />
              {fieldState.error && <p className={errorClass}>Parâmetros do efeito inválidos.</p>}
            </div>
          )}
        />
      )}

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
