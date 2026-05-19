import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

if (pbUrl === 'http://127.0.0.1:8090') {
  console.warn('PocketBase URL is defaulting to localhost. Please configure VITE_PB_URL in your secrets.');
}

const pb = new PocketBase(pbUrl);

export default pb;
