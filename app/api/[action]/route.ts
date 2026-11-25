import { transferApi } from '@/lib/transfer-api';
import { activeCredentials } from '@/lib/server/keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!['status', 'analyze', 'suggestions'].includes(action)) {
    return Response.json({ error: '接口不存在。' }, { status: 404 });
  }
  try {
    const credentials = await activeCredentials();
    return transferApi(request, '/api/' + action, {
      ZHIHU_ACCESS_SECRET: credentials.zhihu,
      DEEPSEEK_API_KEY: credentials.deepseek,
      MODEL_API_BASE_URL: process.env.MODEL_API_BASE_URL,
      MODEL_NAME: process.env.MODEL_NAME,
    });
  } catch {
    return Response.json({ error: '凭证存储暂时不可用。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export { handle as GET, handle as POST };
