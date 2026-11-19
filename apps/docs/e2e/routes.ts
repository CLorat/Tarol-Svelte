import props from '../src/catalogue/props.json' with { type: 'json' };

/** Every component of the catalogue (one page each: the components with a props entry). */
export const components = Object.keys(props);

/** The other pages: guides, tokens and the home page. */
export const others = ['#/guides/first-screen', '#/guides/forms', '#/guides/push', '#/guides/theming', '#/guides/auth', '#/tokens', '#/'];

/** Waits until the page's example (if any) finished its demo reads. */
export const settled = '[data-testid=example]:not(:has([aria-busy=true]))';
