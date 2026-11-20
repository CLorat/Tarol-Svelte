import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { connectPush } from '@clorat/tarol-client/push';
import { mount } from 'svelte';
import App from './App.svelte';
import { tokens } from './auth.js';

const provider = await tokens();
// the backend on its own origin (CORS, BC-1); the docs build for the sample uses its API on :5080
const baseUrl = (import.meta.env['VITE_TAROL_API'] as string | undefined) ?? 'http://localhost:5080';
const client = createClient({ baseUrl, ...(provider ? { tokens: provider } : {}) });
// signed in: the UI push hub, the token in its query string (BC-2); it asks the provider again on every reconnect
const push = provider ? connectPush({ url: `${baseUrl}/tarol/messages`, tokens: provider }) : undefined;
const target = document.getElementById('app');
if (target) mount(App, { target, props: { client, ...(push ? { push } : {}) } });
