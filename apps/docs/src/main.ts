import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { mount } from 'svelte';
import App from './App.svelte';
import { tokens } from './auth.js';

const provider = await tokens();
const client = createClient({ baseUrl: '/api', ...(provider ? { tokens: provider } : {}) });
const target = document.getElementById('app');
if (target) mount(App, { target, props: { client } });
