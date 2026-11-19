const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

/** An amount in euros. */
export const euros = (n: number): string => money.format(n);

/** A short, readable form of an id (its last 6 characters). */
export const short = (id: string): string => id.slice(-6);
