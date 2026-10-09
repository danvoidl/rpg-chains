'use client';

import { useId, useRef, useState } from 'react';
import { uploadImage } from '@/features/media/upload-image';
import { uploadErrorMessage } from '@/features/media/upload-error-message';

interface ImageUploadProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

/** Controlled image upload component: file picker → presign → S3 PUT → preview with remove. */
export function ImageUpload({ id, label, value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const publicUrl = await uploadImage(file);
      onChange(publicUrl);
    } catch (err) {
      setError(uploadErrorMessage(err, 'image'));
    } finally {
      setIsUploading(false);
      // Reset so the same file can be re-selected after an error.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={isUploading}
        onChange={handleFileChange}
        aria-describedby={error ? errorId : undefined}
        className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />

      {isUploading && (
        <p className="text-sm text-gray-500" aria-live="polite">
          Enviando…
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {value && (
        <div className="space-y-2">
          <img
            src={value}
            alt={label}
            className="h-32 w-32 rounded-md border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-600 hover:underline"
          >
            Remover imagem
          </button>
        </div>
      )}
    </div>
  );
}
