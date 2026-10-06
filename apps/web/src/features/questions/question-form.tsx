'use client';

import { useEffect, useId } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type QuestionInput, type Question } from '@rpg-chains/shared-types';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-sm text-red-600';

/**
 * Flat internal form schema that holds all possible fields for both question types.
 * We transform to the correct `QuestionInput` union shape on submit.
 */
const InternalSchema = z
  .object({
    type: z.enum(['objective', 'open']),
    prompt: z.string().trim().min(1, 'Enunciado é obrigatório'),
    options: z.array(
      z.object({ value: z.string().trim().min(1, 'Alternativa não pode ser vazia') }),
    ),
    correctIndex: z.number().int().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'objective') {
      if (data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Adicione pelo menos 2 alternativas',
          path: ['options'],
        });
      }
      if (data.correctIndex >= data.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecione uma resposta correta',
          path: ['correctIndex'],
        });
      }
    }
  });

type InternalValues = z.infer<typeof InternalSchema>;

interface QuestionFormProps {
  /** Prefill values when editing an existing question. */
  defaultValues?: Question;
  submitLabel: string;
  onSubmit: (values: QuestionInput) => Promise<void>;
  isSubmitting: boolean;
}

/** Builds internal form defaults from an optional existing question. */
function buildDefaults(q?: Question): InternalValues {
  if (!q) return { type: 'open', prompt: '', options: [], correctIndex: 0 };
  if (q.type === 'objective') {
    return {
      type: 'objective',
      prompt: q.prompt,
      options: q.options.map((v) => ({ value: v })),
      correctIndex: q.correctIndex,
    };
  }
  return { type: 'open', prompt: q.prompt, options: [], correctIndex: 0 };
}

/** Converts flat internal values to the `QuestionInput` discriminated union. */
function toQuestionInput(internal: InternalValues): QuestionInput {
  if (internal.type === 'objective') {
    return {
      type: 'objective',
      prompt: internal.prompt,
      options: internal.options.map((o) => o.value),
      correctIndex: internal.correctIndex,
    };
  }
  return { type: 'open', prompt: internal.prompt };
}

/** react-hook-form question editor supporting objective and open question types. */
export function QuestionForm({
  defaultValues,
  submitLabel,
  onSubmit,
  isSubmitting,
}: QuestionFormProps) {
  const formId = useId();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<InternalValues>({
    resolver: zodResolver(InternalSchema),
    defaultValues: buildDefaults(defaultValues),
  });

  // Sync when editing a different question.
  useEffect(() => {
    reset(buildDefaults(defaultValues));
  }, [defaultValues, reset]);

  const questionType = watch('type');
  const watchedOptions = watch('options');

  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  // Seed two empty alternatives when switching to objective with none yet.
  useEffect(() => {
    if (questionType === 'objective' && fields.length === 0) {
      append([{ value: '' }, { value: '' }]);
    }
  }, [questionType, fields.length, append]);

  const handleAddOption = () => append({ value: '' });

  const handleFormSubmit = async (internal: InternalValues) => {
    await onSubmit(toQuestionInput(internal));
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Type */}
      <div>
        <label htmlFor={`${formId}-type`} className={labelClass}>
          Tipo
        </label>
        <select id={`${formId}-type`} {...register('type')} className={inputClass}>
          <option value="open">Aberta</option>
          <option value="objective">Objetiva</option>
        </select>
        {errors.type && <p className={errorClass}>{errors.type.message}</p>}
      </div>

      {/* Prompt */}
      <div>
        <label htmlFor={`${formId}-prompt`} className={labelClass}>
          Enunciado
        </label>
        <textarea id={`${formId}-prompt`} rows={3} {...register('prompt')} className={inputClass} />
        {errors.prompt && <p className={errorClass}>{errors.prompt.message}</p>}
      </div>

      {/* Objective-only fields */}
      {questionType === 'objective' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Alternativas</p>

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <label htmlFor={`${formId}-option-${index}`} className={labelClass}>
                  Alternativa {index + 1}
                </label>
                <input
                  id={`${formId}-option-${index}`}
                  type="text"
                  {...register(`options.${index}.value`)}
                  className={inputClass}
                />
                {errors.options?.[index]?.value && (
                  <p className={errorClass}>{errors.options[index].value?.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-6 shrink-0 text-sm text-red-600 hover:underline"
              >
                Remover alternativa
              </button>
            </div>
          ))}

          {errors.options?.root && <p className={errorClass}>{errors.options.root.message}</p>}

          <button
            type="button"
            onClick={handleAddOption}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Adicionar alternativa
          </button>

          {/* Correct answer */}
          <div>
            <label htmlFor={`${formId}-correct`} className={labelClass}>
              Resposta correta
            </label>
            <Controller
              control={control}
              name="correctIndex"
              render={({ field }) => (
                <select
                  id={`${formId}-correct`}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={inputClass}
                >
                  {watchedOptions.map((_opt, i) => (
                    <option key={i} value={i}>
                      Alternativa {i + 1}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.correctIndex && <p className={errorClass}>{errors.correctIndex.message}</p>}
          </div>
        </div>
      )}

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
