import { build } from 'vite';

async function run() {
  console.log('Starting Vite build programmatically...');
  try {
    await build();
    console.log('Vite build finished successfully!');
  } catch (e) {
    console.error('Vite build failed:', e);
    process.exit(1);
  }
}

run();
