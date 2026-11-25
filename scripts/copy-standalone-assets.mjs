import { cpSync, existsSync } from 'node:fs';

if (!existsSync('.next/standalone/server.js')) {
  throw new Error('Expected the Next.js standalone server after the build.');
}

cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
