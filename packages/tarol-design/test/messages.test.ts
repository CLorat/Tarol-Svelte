import { describe, expect, it } from 'vitest';
import { de } from '../src/lib/de.js';
import { en } from '../src/lib/en.js';
import { translator } from '../src/lib/messages.js';

describe('messages', () => {
  it('de and en have the same keys (philosophy P7)', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('fills parameters and picks the one-sided text when a bound is missing', () => {
    const t = translator(en);
    expect(t('Length', { min: 3, max: 80 })).toBe('Enter between 3 and 80 characters.');
    expect(t('Length', { max: 80 })).toBe('Enter at most 80 characters.');
    expect(t('Range', { min: 1 })).toBe('Enter a value of at least 1.');
    expect(t('Range')).toBe('The value is out of range.');
    expect(t('Required')).toBe('This field is required.');
  });

  it('falls back from X.Y to the generic Y before error.generic (TS-2)', () => {
    const t = translator({ 'Membership.NotFound': 'Diesen Zugang gibt es nicht.' }, de);
    expect(t('ChildDayCare.NotFound')).toBe('Diesen Eintrag gibt es nicht (mehr).');
    expect(t('Membership.NotFound')).toBe('Diesen Zugang gibt es nicht.'); // the app's own text wins
    expect(t('ChildDayCare.AlreadyExists')).toBe('Diesen Eintrag gibt es schon.');
    expect(translator(en)('Plot.AlreadyExists')).toBe('This item exists already.');
    expect(t('Bid.TooLow')).toBe('Etwas ist schiefgelaufen.'); // no generic TooLow: error.generic
    expect(t('Billing.Invoice.NotFound')).toBe('Diesen Eintrag gibt es nicht (mehr).');
  });

  it('tries the app catalogue first and falls back to the generic text for unknown codes', () => {
    const t = translator({ 'Auction.NotSeller': 'Only the seller can settle.' }, de);
    expect(t('Auction.NotSeller')).toBe('Only the seller can settle.');
    expect(t('Bid.TooLow')).toBe('Etwas ist schiefgelaufen.');
    expect(translator({})('x')).toBe('x');
  });
});
