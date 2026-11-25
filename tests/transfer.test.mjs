import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeExperience, readProfile, suggestConditions } from '../lib/analysis.ts';
import { activeConflicts, availableSuggestions, completeBackground } from '../lib/background.ts';

const model = { apiKey: 'test-model-key' };
const profile = readProfile({ goal: '六周内准备英文面试', background: '大学', conditions: ['曾参加社团活动'], hours: 4, weeks: 6 });

function modelResponse(value) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
}

test('background hints use the current draft and only return model-generated selectable options', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).origin, 'https://api.deepseek.com');
    assert.equal(options.headers.Authorization, 'Bearer test-model-key');
    const request = JSON.parse(options.body);
    assert.equal(request.response_format.type, 'json_object');
    const input = JSON.parse(request.messages[1].content);
    assert.equal(input.goal, profile.goal);
    assert.equal(input.hours, 4);
    assert.deepEqual(input.conditions, profile.conditions);
    const current = input.background === '大学' ? '英语专业在读' : '有电话面试经验';
    return modelResponse({
      suggestions: [current, '没有相关经历', '曾参加社团活动', '是否考过英语四级'],
      conflicts: [[current, '没有相关经历'], ['没有相关经历', current], [current, '不存在的选项']],
    });
  });
  assert.deepEqual(await suggestConditions(profile, model), {
    suggestions: ['英语专业在读', '没有相关经历'], conflicts: [['英语专业在读', '没有相关经历']],
  });
  assert.deepEqual(await suggestConditions({ ...profile, background: '已毕业' }, model), {
    suggestions: ['有电话面试经验', '没有相关经历'], conflicts: [['有电话面试经验', '没有相关经历']],
  });
  assert.equal(mock.mock.callCount(), 2);
});

test('choosing a background suggestion appends editable text and hides both itself and its opposite', () => {
  const batch = {
    suggestions: ['有过实习经历', '暂无实习经历', '以校内课程为主'],
    conflicts: [['有过实习经历', '暂无实习经历']],
  };
  const background = completeBackground('大学在读', '暂无实习经历');
  assert.equal(background, '大学在读，暂无实习经历');
  assert.equal(completeBackground('大学在读。', '有过实习经历'), '大学在读。有过实习经历');
  assert.equal(completeBackground('大学在读\n', '有过实习经历'), '大学在读\n有过实习经历');
  assert.deepEqual(availableSuggestions(batch, background), ['以校内课程为主']);
  assert.deepEqual(availableSuggestions(batch, '有过实习经历'), ['以校内课程为主']);
  assert.deepEqual(availableSuggestions(batch, '大学在读'), batch.suggestions);
  const laterBatch = { suggestions: ['有过实习经历', '参加过课程项目'], conflicts: activeConflicts(batch.conflicts, background) };
  assert.deepEqual(availableSuggestions(laterBatch, background), ['参加过课程项目']);
  assert.deepEqual(activeConflicts(batch.conflicts, '大学在读'), []);
});

test('live reports use a fresh search and reject evidence strings that are absent from the source', async (t) => {
  const quote = '我每周五用一小时复盘';
  const source = {
    Title: '英语面试准备复盘', ContentType: 'Answer', ContentID: '123',
    ContentText: `准备期间，<em>${quote}</em>，并记录三个值得继续尝试的做法。`,
    Url: 'https://www.zhihu.com/answer/123?utm_medium=openapi_platform', AuthorName: '测试作者',
  };
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = new URL(url);
    assert.equal(options.redirect, 'manual');
    if (target.hostname === 'developer.zhihu.com') {
      assert.equal(options.headers.Authorization, 'Bearer zhihu-test-secret');
      assert.ok(target.searchParams.get('Query')?.includes(profile.goal));
      return Response.json({ Code: 0, Data: { Items: [source, source] } });
    }
    assert.equal(target.href, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-model-key');
    const request = JSON.parse(options.body);
    const input = JSON.parse(request.messages[1].content);
    assert.deepEqual(input.profile.conditions, profile.conditions);
    assert.equal(input.sources.length, 1);
    const decision = {
      title: '留出一次复盘', verdict: 'adapt', condition: '作者每周都复盘。',
      comparison: '每周可安排少量时间。', advice: '先试一次二十分钟。',
      evidence: { sourceId: 'case-1', quote: input.profile.background === '伪造引文测试' ? '作者已经拿到五个录用通知' : quote },
    };
    const suggestedAction = { title: '复盘一次', detail: '回看两个做法。', output: '一份记录', sourceId: 'case-1' };
    const before = { ...suggestedAction, milestone: '投递简历', fallback: { trigger: '投递后没有邀约', detail: '按岗位逐项检查简历。' } };
    const after = { ...suggestedAction, milestone: '面试通过后', fallback: { trigger: '面试未通过', detail: '对卡住的题目做针对性模拟。' } };
    if (input.profile.background === '缺少预案测试') delete after.fallback;
    return modelResponse({
      summary: '尝试短时间复盘。', decisions: [decision],
      actions: { after, before, short: suggestedAction, now: suggestedAction },
    });
  });
  const report = await analyzeExperience(profile, 'zhihu-test-secret', model);
  assert.equal(report.decisions[0].evidence.quote, quote);
  assert.equal(report.sources[0].url, source.Url);
  assert.deepEqual(report.actions.map(({ when }) => when), ['现在立刻去做', '短期计划', '投递简历前', '面试通过后']);
  assert.equal(report.actions[2].fallback.trigger, '投递后没有邀约');
  assert.equal(report.actions[3].fallback.trigger, '面试未通过');
  await assert.rejects(analyzeExperience({ ...profile, background: '伪造引文测试' }, 'zhihu-test-secret', model), { status: 422 });
  await assert.rejects(analyzeExperience({ ...profile, background: '缺少预案测试' }, 'zhihu-test-secret', model), { status: 422, message: /完整的行动流程和节点预案/ });
  assert.equal(mock.mock.callCount(), 6);
});

test('the report can use selected conditions with optional time fields', () => {
  assert.equal(readProfile({ goal: profile.goal, conditions: ['零基础'] }).hours, null);
  assert.throws(() => readProfile({ ...profile, weeks: 0 }), { status: 400 });
  assert.throws(() => readProfile({ goal: profile.goal }), { status: 400 });
});
