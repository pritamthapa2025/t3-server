import { execSync } from 'node:child_process';

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  console.log('Skipping lint in production build.');
  process.exit(0);
}

execSync('npm run lint:warnings-ok', { stdio: 'inherit' });

