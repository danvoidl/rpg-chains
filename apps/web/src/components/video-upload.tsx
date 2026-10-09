'use client';

import { useId, useRef, useState } from 'react';
import { uploadMedia } from '@/features/media/upload-image';
import { uploadErrorMessage } from '@/features/media/upload-error-message';

interface VideoUploadProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

/** Controlled video field: file picker (presign + PUT) or a pasted URL, with a preview and remove. */
export function VideoUpload({ id, label, value, onChange }: VideoUploadProps) {
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
      onChange(await uploadMedia(file));
    } catch (err) {
      setError(uploadErrorMessage(err, 'video'));
    } finally {
      setIsUploading(false);
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
        accept="video/mp4,video/webm"
        disabled={isUploading}
        onChange={handleFileChange}
        aria-describedby={error ? errorId : undefined}
        className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />

      <div>
        <label htmlFor={`${id}-url`} className="block text-xs text-gray-500">
          ou cole a URL de um vídeo
        </label>
        <input
          id={`${id}-url`}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

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
          <video
            src={value}
            controls
            className="max-h-48 w-full rounded-md border border-gray-200 bg-black"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-600 hover:underline"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  );
}
