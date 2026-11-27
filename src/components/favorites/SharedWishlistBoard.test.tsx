import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SharedWishlistBoard, { SHARED_WISHLIST_MAX_NOTE_LEN } from './SharedWishlistBoard';
import { settle } from '../../test/settle';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('GUEST-091 SharedWishlistBoard', () => {
  test('renders shared board, toggles 1-click upvote without mutating personal favorites, and posts <=200 char note', async () => {
    const fetchSpy = vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/public/wishlists/board_abc') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            token: 'board_abc',
            title: 'Coorg Family Trip',
            items: [
              {
                listingId: 101,
                title: 'Coffee Estate Villa',
                voteCount: 2,
                viewerVoted: false,
                notes: [{ id: 'n1', authorName: 'Priya', text: 'Love the veranda!' }],
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/votes')) {
        return new Response(JSON.stringify({ voteCount: 3, viewerVoted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/notes')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    render(
      <MemoryRouter>
        <SharedWishlistBoard
          boardToken="board_abc"
          listingsById={
            new Map([
              [101, { id: 101, name: 'Coffee Estate Villa', href: '/homes/coffee-estate-villa/101', priceLabel: '₹6,500 / night' }],
            ])
          }
          defaultVisitorName="Ravi"
        />
      </MemoryRouter>
    );

    await settle();
    expect(screen.getByTestId('shared-wishlist-board')).toHaveTextContent('Coorg Family Trip');
    expect(screen.getByTestId('wishlist-vote-count-101')).toHaveTextContent('2');

    // Toggle upvote
    fireEvent.click(screen.getByTestId('wishlist-vote-btn-101'));
    await settle();
    expect(screen.getByTestId('wishlist-vote-count-101')).toHaveTextContent('3');
    expect(window.localStorage.getItem('atlas_favorites')).toBeNull();

    // Expand notes & post a note > 200 chars (clamped to 200)
    fireEvent.click(screen.getByTestId('wishlist-notes-toggle-101'));
    const input = screen.getByTestId('wishlist-note-input-101') as HTMLInputElement;
    const longText = 'A'.repeat(250);
    fireEvent.change(input, { target: { value: longText } });
    expect(input.value.length).toBe(SHARED_WISHLIST_MAX_NOTE_LEN);

    fireEvent.click(screen.getByTestId('wishlist-note-submit-101'));
    await settle();
    expect(screen.getByTestId('wishlist-notes-panel-101')).toHaveTextContent('Ravi:');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/wishlists/board_abc/notes'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
