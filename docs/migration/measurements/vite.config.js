import { svelte } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [svelte()], logLevel: 'error', build: { minify: 'esbuild', target: 'es2022', emptyOutDir: false, modulePreload: false, lib: { entry: process.env.E, formats: ['es'], fileName: () => process.env.O + '.js' }, outDir: 'dist' } };
