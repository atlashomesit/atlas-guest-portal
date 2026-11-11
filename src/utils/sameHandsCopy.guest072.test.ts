import { describe, expect, test } from 'vitest';
import { sameHands } from '@/utils/sameHandsCopy';

describe('sameHands (GUEST-072)', () => {
  test('one home reads it, never them', () => {
    expect(sameHands(1)).toBe('Same hands clean it, restock it, and answer the door.');
  });
  test('several homes read them', () => {
    expect(sameHands(2)).toContain('clean them');
    expect(sameHands(8)).toContain('restock them');
  });
});
