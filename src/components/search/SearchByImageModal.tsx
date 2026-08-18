import { useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../../api/client';
import type { PublicListing } from '../../api/listingClient';
import { Modal } from '../ui/Modal';

export type ImageSearchMatch = {
  listing: PublicListing;
  score: number;
};

type SearchByImageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onResults: (matches: ImageSearchMatch[]) => void;
};

export function SearchByImageModal({ isOpen, onClose, onResults }: SearchByImageModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setError('Choose a photo to search.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(buildApiUrl('/search/by-image'), {
        method: 'POST',
        headers: getApiHeaders(),
        body: fd,
      });
      if (res.status === 404) {
        onClose();
        return;
      }
      if (res.status === 503 || !res.ok) {
        onClose();
        return;
      }
      const data = (await res.json()) as { matches?: ImageSearchMatch[] };
      onResults(data.matches ?? []);
      onClose();
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search by photo">
      <div className="space-y-4">
        <p className="text-sm text-text-body">
          Upload a photo of a property and we&apos;ll find similar listings from this host.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={loading || !file}>
            {loading ? 'Searching…' : 'Find similar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
