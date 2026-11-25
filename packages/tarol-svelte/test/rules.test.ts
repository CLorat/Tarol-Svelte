import { describe, expect, it } from 'vitest';
import { check, isEmail, rulePath } from '../src/rules.js';

describe('rules', () => {
  it('returns the code of the first failing rule, one per value', () => {
    const rules = [
      { rule: 'NotEmpty', code: 'Required' },
      { rule: 'Length', code: 'Length', min: 3, max: 5 },
      { rule: 'Pattern', code: 'Pattern', pattern: '^[a-z]+$' },
    ] as const;
    expect(check('', rules)).toBe('Required');
    expect(check('ab', rules)).toBe('Length');
    expect(check('abc1', rules)).toBe('Pattern');
    expect(check('abcd', rules)).toBeNull();
  });

  it('lets an empty optional value pass every rule but Required', () => {
    expect(check(null, [{ rule: 'Range', code: 'Range', min: 1 }])).toBeNull();
    expect(check(undefined, [{ rule: 'Required', code: 'Required' }])).toBe('Required');
  });

  it('checks Range, Length in UTF-16 units, Count and Pattern with the u flag', () => {
    expect(check(0, [{ rule: 'Range', code: 'Range', min: 1, max: 10 }])).toBe('Range');
    expect(check(10, [{ rule: 'Range', code: 'Range', min: 1, max: 10 }])).toBeNull();
    expect(check('😀😀', [{ rule: 'Length', code: 'Length', max: 3 }])).toBe('Length'); // 4 UTF-16 units, as .NET counts
    expect(check([1, 2, 3], [{ rule: 'Count', code: 'Count', min: 1, max: 2 }])).toBe('Count');
    expect(check('😀', [{ rule: 'Pattern', code: 'Pattern', pattern: '^.$' }])).toBeNull();
    expect(check('ABC', [{ rule: 'Pattern', code: 'Pattern', pattern: '^[a-z]+$', flags: 'i' }])).toBeNull();
  });

  it('applies the backend email rule exactly', () => {
    expect(isEmail('ada@example.org')).toBe(true);
    for (const bad of [
      '@example.org',
      'ada@@example.org',
      'ada@example',
      'ada@.example.org',
      'ada@example.org.',
      'ada@ex..org',
      'a da@example.org',
      `${'a'.repeat(65)}@example.org`,
      `a@${'b'.repeat(250)}.org`,
    ])
      expect(isEmail(bad), bad).toBe(false);
  });

  it('takes the flags of x-tarol-rules: i, and u without doubling it', () => {
    const letters = [{ rule: 'Pattern', code: 'Pattern', pattern: '^\\p{Lu}+$', flags: 'u' }] as const;
    expect(check('ÄBC', letters)).toBeNull();
    expect(check('abc', letters)).toBe('Pattern');
    const code = [{ rule: 'Pattern', code: 'Currency', pattern: '^[a-z]{3}$', flags: 'i' }] as const;
    expect(check('EUR', code)).toBeNull();
    expect(check('EURO', code)).toBe('Currency');
  });

  it('checks Scale: a multiple of the step, without float noise (TS-29)', () => {
    const cents = [{ rule: 'Scale', code: 'Scale', step: 0.01 }] as const;
    expect([check(12.34, cents), check(1e21, cents), check(-3.5, cents), check(0.3, cents)]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    // the digits of the JSON text count, as the backend's decimal reads it: 0.1 + 0.2 is sent as 0.30000000000000004
    expect([check(12.345, cents), check(0.1 + 0.2, cents), check(1e-7, cents), check('12.34', cents)]).toEqual([
      'Scale',
      'Scale',
      'Scale',
      'Scale',
    ]);
    expect(check(null, cents)).toBeNull();
    expect(check(0.75, [{ rule: 'Scale', code: 'Scale', step: 0.25 }])).toBeNull();
  });

  it('maps concrete paths to rule keys', () => {
    expect(rulePath('lines[12].quantity')).toBe('lines[].quantity');
    expect(rulePath('customer')).toBe('customer');
  });
});
