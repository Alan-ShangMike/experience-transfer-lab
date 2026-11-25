import { adminApi } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  return adminApi(request, action);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
