import React, { useState, useRef } from 'react';

const MAX_ID_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_ID_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export interface GuestIdUploadProps {
  label?: string;
  guestName?: string;
  onFileSelect?: (file: File | null) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * TASK-1039907: Government ID scan upload component with preview thumbnail
 * and validation for file size (< 5MB) and mime types.
 */
export const GuestIdUpload: React.FC<GuestIdUploadProps> = ({
  label = 'Government ID Upload',
  guestName,
  onFileSelect,
  onError,
  className = '',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    const mime = file.type?.toLowerCase();
    const isMimeAllowed = mime && ALLOWED_ID_MIME_TYPES.includes(mime);
    const hasAllowedExt = /\.(jpe?g|png|webp|pdf)$/i.test(file.name);

    if (!isMimeAllowed && !hasAllowedExt) {
      const err = 'Invalid file type. Please upload a valid JPG, PNG, WEBP image or PDF document.';
      setValidationError(err);
      onError?.(err);
      return;
    }

    // Validate file size (< 5MB)
    if (file.size > MAX_ID_FILE_SIZE_BYTES) {
      const err = 'File size exceeds 5 MB limit. Please upload an image under 5 MB.';
      setValidationError(err);
      onError?.(err);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
    onFileSelect?.(file);

    // If image, create thumbnail preview
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPreviewUrl(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
    onFileSelect?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-4 space-y-3 ${className}`}
      data-testid="guest-id-upload-container"
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900" data-testid="guest-id-upload-label">
            {label} {guestName ? `(${guestName})` : ''}
          </h4>
          <p className="text-xs text-neutral-500">
            Government issued ID (Aadhaar, Passport, Driving License) · Max 5 MB
          </p>
        </div>
      </div>

      {previewUrl ? (
        <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50 text-center space-y-2" data-testid="id-preview-box">
          <img
            src={previewUrl}
            alt="Government ID preview"
            data-testid="id-preview-thumbnail"
            className="max-h-40 mx-auto rounded-lg object-contain shadow-2xs border border-neutral-200"
          />
          <p className="text-xs font-medium text-neutral-700 truncate max-w-xs mx-auto" data-testid="id-preview-filename">
            {selectedFile?.name} ({(selectedFile ? selectedFile.size / 1024 : 0).toFixed(0)} KB)
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 transition-colors"
              data-testid="id-remove-button"
            >
              Remove / Replace
            </button>
          </div>
        </div>
      ) : selectedFile ? (
        <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50 flex items-center justify-between" data-testid="id-pdf-box">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="text-xs font-medium text-neutral-700 truncate max-w-xs">{selectedFile.name}</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="px-2.5 py-1 rounded border border-neutral-300 text-xs text-neutral-700 bg-white hover:bg-neutral-100"
            data-testid="id-remove-button"
          >
            Remove
          </button>
        </div>
      ) : (
        <div>
          <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-neutral-300 hover:border-indigo-500 rounded-xl cursor-pointer bg-neutral-50/60 hover:bg-indigo-50/30 transition-colors">
            <span className="text-2xl mb-1">📷</span>
            <span className="text-xs font-semibold text-neutral-800">
              Select or Take Photo of Government ID
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5">
              JPG, PNG, or WEBP under 5 MB
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              data-testid="guest-id-file-input"
            />
          </label>
        </div>
      )}

      {validationError && (
        <p className="text-xs text-red-600 font-medium" role="alert" data-testid="id-upload-error">
          {validationError}
        </p>
      )}
    </div>
  );
};

export default GuestIdUpload;
