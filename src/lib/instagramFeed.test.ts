import { describe, it, expect } from 'vitest';
import { instagramProfileUrl, normalizeInstagramMedia, overlayLabel } from './instagramFeed';

describe('TASK-102266 instagram feed widget', () => {
  it('normalizes Basic Display API rows, dropping malformed items', () => {
    const rows = normalizeInstagramMedia([
      { id: 'm1', mediaUrl: 'https://cdn/img1.jpg', likeCount: 120, commentsCount: 8 },
      { id: 42, mediaUrl: 'https://cdn/bad.jpg' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].permalink).toBe('https://www.instagram.com/p/m1');
  });

  it('links to the host profile and renders overlay counters', () => {
    expect(instagramProfileUrl('@goan.hideaway')).toBe('https://www.instagram.com/goan.hideaway/');
    expect(overlayLabel({ likeCount: 120, commentsCount: 8 })).toBe('120 likes · 8 comments');
  });
});
