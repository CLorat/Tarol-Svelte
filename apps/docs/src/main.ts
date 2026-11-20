import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { mount } from 'svelte';
import App from './App.svelte';
import { tokens } from './auth.js';

const provider = await tokens();
// the backend on its own origin (CORS, BC-1); the docs build for the sample uses its API on :5080
const baseUrl = (import.meta.env['VITE_TAROL_API'] as string | undefined) ?? 'http://localhost:5080';
const client = createClient({ baseUrl, ...(provider ? { tokens: provider } : {}) });
const target = document.getElementById('app');
if (target) mount(App, { target, props: { client } });
