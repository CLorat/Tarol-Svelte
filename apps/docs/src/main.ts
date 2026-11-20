import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { connectPush } from '@clorat/tarol-client/push';
import { mount } from 'svelte';
import App from './App.svelte';
import { signIn } from './auth.js';
import { router } from './router.svelte.js';

const oidc = await signIn();
// the backend on its own origin (CORS); the docs build for the sample uses its API on :5080
const baseUrl = (import.meta.env['VITE_TAROL_API'] as string | undefined) ?? 'http://localhost:5080';
const client = createClient({ baseUrl, ...(oidc ? { tokens: oidc.provider } : {}) });
// signed in: the UI push hub, the token in its query string; it asks the provider again on every reconnect
const push = oidc?.session() ? connectPush({ url: `${baseUrl}/tarol/messages`, tokens: oidc.provider }) : undefined;
router.sync(); // the login callback replaced the URL with the path it started from
const target = document.getElementById('app');
if (target) mount(App, { target, props: { client, ...(push ? { push } : {}), ...(oidc ? { oidc } : {}) } });
