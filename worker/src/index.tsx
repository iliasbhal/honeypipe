import { Hono } from 'hono'
import { SignalBroker, SignalingEvent, SignalPullRequest } from '@honeypipe/client';



const API = new Hono();

export default API;

const signalBroker = new SignalBroker();

API.get('/health', async (c) => {
  return await c.text('OK', 200);
});

const instanceID = Date.now().toString();
API.get('/metadata', async (c) => {
  return await c.json({
    appVersion: process.env.WASMER_APP_VERSION_ID,
    instanceId: instanceID,
  }, 200);
})

API.get('/push', async (c) => {
  const query = await c.req.query();
  if (!query?.data) {
    return await c.text('Missing data parameter', 400);
  }

  try {
    const signal = JSON.parse(query.data) as SignalingEvent;
    await signalBroker.push(signal);
    return await  c.text('OK');
  } catch (error) {
    return await c.text('Invalid JSON data', 400);
  }
});

API.get('/pull', async (c) => {
  const query = await c.req.query();

  if (!query?.data) {
    return await c.text('Missing data parameter', 400);
  }

  try {
    const request = JSON.parse(query.data) as SignalPullRequest;
    const signals = await signalBroker.pull(request);
    return await c.json(signals, 200);
  } catch (error) {
    return await c.text('Invalid JSON data', 400);
  }
});


// API.get('*', async (c) => {
//   const url = addStaticToPathname(c.req.raw.url)
//   // @ts-ignore
//   return c.env.ASSETS.fetch(url);
// });


// export function addStaticToPathname(url: string): string {
//   const urlObj = new URL(url);
  
//   const isIndex = urlObj.pathname === '/'
//     || urlObj.pathname === ''
//     || urlObj.pathname === '/index.html';
//   if (isIndex) {
//     urlObj.pathname = '/static/index.html';
//     return urlObj.toString();
//   }
  
//   // For all other cases, insert "static" after the first slash
//   // This handles cases like /staticaa/aaa.html -> /static/aaa.html
//   const pathParts = urlObj.pathname.split('/').filter(part => part !== '');
//   pathParts.unshift('static');
//   urlObj.pathname = '/' + pathParts.join('/');
//   return urlObj.toString();
// }