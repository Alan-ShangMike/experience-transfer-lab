import { analyzeExperience, readProfile, ReportError, suggestConditions } from './analysis';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

type TransferConfig = { ZHIHU_ACCESS_SECRET?: string; DEEPSEEK_API_KEY?: string; MODEL_API_BASE_URL?: string; MODEL_NAME?: string };

export async function transferApi(request: Request, path: string, env: TransferConfig) {
  const credential = env.ZHIHU_ACCESS_SECRET?.trim();
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (path === '/api/status') {
    if (request.method !== 'GET') return json({ error: '请求方式不支持。' }, 405);
    return json({ suggestions: Boolean(apiKey), live: Boolean(credential && apiKey) });
  }
  if (request.method !== 'POST') return json({ error: '请求方式不支持。' }, 405);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: '请求格式有误。' }, 415);
  }
  const isSuggestion = path === '/api/suggestions';
  if (!apiKey) return json({ error: '实时提示和分析需要服务端配置模型凭证。' }, 503);
  if (!isSuggestion && !credential) return json({ error: '实时报告需要配置资料检索的服务端凭证。' }, 503);

  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return json({ error: '输入内容过长。' }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: '请求格式有误。' }, 400);
  }

  try {
    const profile = readProfile(input, isSuggestion);
    const model = { apiKey, baseUrl: env.MODEL_API_BASE_URL, model: env.MODEL_NAME };
    if (isSuggestion) {
      if (!profile.goal && !profile.background && !profile.conditions.length) return json({ suggestions: [], conflicts: [] });
      return json(await suggestConditions(profile, model, request.signal));
    }
    return json(await analyzeExperience(profile, credential!, model, request.signal));
  } catch (error) {
    if (error instanceof ReportError) return json({ error: error.message }, error.status);
    return json({ error: '分析暂时无法完成，请稍后重试。' }, 500);
  }
}
