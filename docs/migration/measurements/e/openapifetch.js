import createClient from 'openapi-fetch';
const c = createClient({ baseUrl: '/' });
c.POST('/orders', { body: { a: 1 } }).then(console.log);
