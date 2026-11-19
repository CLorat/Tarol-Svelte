import { HubConnectionBuilder } from '@microsoft/signalr';
export const c = new HubConnectionBuilder().withUrl('/tarol/messages', { accessTokenFactory: () => 't' }).withAutomaticReconnect().build();
c.on('message', (m) => console.log(m));
c.start().then(() => c.invoke('Subscribe', 'orders'));
