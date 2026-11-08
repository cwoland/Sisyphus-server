import { waitUntil } from '@vercel/functions';

// Keep non-critical tasks alive after the HTTP response on Vercel.
export const runBackground = (promise, label) => {
  const task = promise.catch((error) => {
    console.error(`${label}:`, error.message);
  });
  if (process.env.VERCEL) waitUntil(task);
};
