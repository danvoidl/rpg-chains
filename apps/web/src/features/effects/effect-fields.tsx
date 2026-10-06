'use client';

import { ALLOWED_TARGETS } from '@rpg-chains/campaign-rules';
import {
  AttributeSchema,
  EffectSchema,
  MagnitudeSchema,
  ModifiableStatSchema,
  type Effect,
  type EffectType,
  type Magnitude,
  type MagnitudeMode,
  type Target,
} from '@rpg-chains/shared-types';
import { defaultEffect, defaultMagnitude } from './effect-defaults';
import {
  ATTRIBUTE_LABELS,
  EFFECT_TYPE_LABELS,
  MAGNITUDE_MODE_LABELS,
  STAT_LABELS,
  TARGET_LABELS,
} from './effect-labels';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';

const EFFECT_TYPES = EffectSchema.options.map((option) => option.shape.type.value) as EffectType[];
const MAGNITUDE_MODES = MagnitudeSchema.options.map(
  (option) => option.shape.mode.value,
) as MagnitudeMode[];

/** Parses a number input; an empty field becomes NaN so the schema reports it. */
function toNumber(raw: string): number {
  return raw === '' ? Number.NaN : Number(raw);
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}

function NumberField({ id, label, value, onChange, step = 1 }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

interface MagnitudeFieldsProps {
  id: string;
  label: string;
  value: Magnitude;
  onChange: (value: Magnitude) => void;
}

/** Magnitude editor: the mode select swaps the fields (fixed / percent / scaling). */
function MagnitudeFields({ id, label, value, onChange }: MagnitudeFieldsProps) {
  return (
    <fieldset className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-4">
      <legend className="sr-only">{label}</legend>
      <div>
        <label htmlFor={`${id}-mode`} className={labelClass}>
          {label}
        </label>
        <select
          id={`${id}-mode`}
          value={value.mode}
          onChange={(e) => onChange(defaultMagnitude(e.target.value as MagnitudeMode))}
          className={inputClass}
        >
          {MAGNITUDE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {MAGNITUDE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
      {value.mode === 'fixed' && (
        <NumberField
          id={`${id}-value`}
          label="Valor"
          value={value.value}
          onChange={(v) => onChange({ ...value, value: v })}
        />
      )}
      {value.mode === 'percent' && (
        <NumberField
          id={`${id}-percent`}
          label="Percentual (%)"
          value={value.percent}
          onChange={(v) => onChange({ ...value, percent: v })}
        />
      )}
      {value.mode === 'scaling' && (
        <>
          <NumberField
            id={`${id}-base`}
            label="Base"
            value={value.base}
            onChange={(v) => onChange({ ...value, base: v })}
          />
          <div>
            <label htmlFor={`${id}-attribute`} className={labelClass}>
              Atributo
            </label>
            <select
              id={`${id}-attribute`}
              value={value.attribute}
              onChange={(e) =>
                onChange({ ...value, attribute: e.target.value as typeof value.attribute })
              }
              className={inputClass}
            >
              {AttributeSchema.options.map((attribute) => (
                <option key={attribute} value={attribute}>
                  {ATTRIBUTE_LABELS[attribute]}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            id={`${id}-scale`}
            label="Escala (×)"
            step={0.1}
            value={value.scale}
            onChange={(v) => onChange({ ...value, scale: v })}
          />
        </>
      )}
    </fieldset>
  );
}

interface EffectFieldsProps {
  /** Prefix for input ids, unique per effect on the page. */
  id: string;
  value: Effect;
  onChange: (value: Effect) => void;
}

/**
 * Controlled editor for one effect of the catalog (spec §5.4): picking a type resets the
 * parameters to that type's defaults, and the target select only offers targets allowed for the
 * type (`ALLOWED_TARGETS`, the same rule the publish gate enforces).
 */
export function EffectFields({ id, value, onChange }: EffectFieldsProps) {
  // Each setter rebuilds the same variant, so the spread keeps the discriminant intact.
  const patch = (changes: Partial<Effect>) => onChange({ ...value, ...changes } as Effect);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2">
        <label htmlFor={`${id}-type`} className={labelClass}>
          Tipo de efeito
        </label>
        <select
          id={`${id}-type`}
          value={value.type}
          onChange={(e) => onChange(defaultEffect(e.target.value as EffectType))}
          className={inputClass}
        >
          {EFFECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EFFECT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {value.type !== 'provoke' && (
        <div className="col-span-2">
          <label htmlFor={`${id}-target`} className={labelClass}>
            Alvo
          </label>
          <select
            id={`${id}-target`}
            value={value.target}
            onChange={(e) => patch({ target: e.target.value as Target })}
            className={inputClass}
          >
            {ALLOWED_TARGETS[value.type].map((target) => (
              <option key={target} value={target}>
                {TARGET_LABELS[target]}
              </option>
            ))}
          </select>
        </div>
      )}

      {(value.type === 'buff_attribute' || value.type === 'debuff_attribute') && (
        <div className="col-span-2">
          <label htmlFor={`${id}-stat`} className={labelClass}>
            Atributo afetado
          </label>
          <select
            id={`${id}-stat`}
            value={value.attribute}
            onChange={(e) => patch({ attribute: e.target.value as typeof value.attribute })}
            className={inputClass}
          >
            {ModifiableStatSchema.options.map((stat) => (
              <option key={stat} value={stat}>
                {STAT_LABELS[stat]}
              </option>
            ))}
          </select>
        </div>
      )}

      {'magnitude' in value && (
        <MagnitudeFields
          id={`${id}-magnitude`}
          label="Magnitude"
          value={value.magnitude}
          onChange={(magnitude) => patch({ magnitude })}
        />
      )}
      {'magnitudePerRound' in value && (
        <MagnitudeFields
          id={`${id}-per-round`}
          label="Magnitude por rodada"
          value={value.magnitudePerRound}
          onChange={(magnitudePerRound) => patch({ magnitudePerRound })}
        />
      )}

      {'duration' in value && (
        <NumberField
          id={`${id}-duration`}
          label="Duração (rodadas)"
          value={value.duration}
          onChange={(duration) => patch({ duration })}
        />
      )}

      {value.type === 'revive' && (
        <NumberField
          id={`${id}-health`}
          label="Vida recuperada (%)"
          value={value.healthPercent}
          onChange={(healthPercent) => patch({ healthPercent })}
        />
      )}

      {value.type === 'dispel' && (
        <>
          <NumberField
            id={`${id}-amount`}
            label="Quantidade"
            value={value.amount}
            onChange={(amount) => patch({ amount })}
          />
          <div>
            <label htmlFor={`${id}-removes`} className={labelClass}>
              Remove
            </label>
            <select
              id={`${id}-removes`}
              value={value.removes}
              onChange={(e) => patch({ removes: e.target.value as 'buffs' | 'debuffs' })}
              className={inputClass}
            >
              <option value="buffs">Buffs</option>
              <option value="debuffs">Debuffs</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
