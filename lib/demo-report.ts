import type { Profile, Report } from './transfer';

export function demoReport(profile: Profile): Report {
  return {
    mode: 'live',
    summary: '先用一周时间把常见面试问题整理成自己的英文回答，再每天固定做口语复述。',
    profile,
    sources: [
      { id: 'case-1', title: '六周从零准备英文面试，我是怎么安排的', url: 'https://www.zhihu.com/', kind: 'article', author: '示例作者',
        excerpt: '每天二十分钟跟读面试高频问题，把自我介绍、项目经历和职业规划写成英文稿，再对着镜子录音复盘。口语练习比背单词更直接有效。' },
      { id: 'case-2', title: '外企面试前一周，该做哪些模拟训练', url: 'https://www.zhihu.com/', kind: 'answer', author: '示例作者',
        excerpt: '面试前一周找朋友做两次模拟面试，重点练习行为面试问题，用 STAR 结构讲项目经历，并记录卡住的问题逐个补练。' },
      { id: 'case-3', title: '面试没通过之后，怎么做复盘', url: 'https://www.zhihu.com/', kind: 'article', author: '示例作者',
        excerpt: '没通过也不要立刻海投，先整理卡住的题目，补练口语表达和专业词汇，再申请同类岗位，通常第二次面试会明显更稳。' },
    ],
    decisions: [
      { title: '每天跟读高频面试问题', verdict: 'reuse', condition: '作者每天固定练二十分钟口语',
        comparison: '你每周有 6 小时，折算下来每天约 50 分钟，足够覆盖。', advice: '直接照做，把练习放在固定时段，坚持录音复盘。',
        evidence: { sourceId: 'case-1', quote: '每天二十分钟跟读面试高频问题' } },
      { title: '找朋友做两次模拟面试', verdict: 'adapt', condition: '作者身边有可以陪练的朋友',
        comparison: '你的背景里没有提到合适的陪练对象。', advice: '没有陪练时，用录音加自评表代替，并在社群里约一次线上模拟。',
        evidence: { sourceId: 'case-2', quote: '面试前一周找朋友做两次模拟面试' } },
      { title: '没通过后立刻海投', verdict: 'hold', condition: '作者的建议是先复盘再投递',
        comparison: '你的准备期只有六周，容错次数有限。', advice: '先不要照搬海投，失败后按卡住的题目复盘再申请同类岗位。',
        evidence: { sourceId: 'case-3', quote: '先整理卡住的题目，补练口语表达和专业词汇' } },
    ],
    actions: [
      { stage: 'now', when: '现在立刻去做', title: '写出英文自我介绍初稿', detail: '用三分钟写出目标岗位的自我介绍，再大声读两遍并录音。',
        output: '一份一百字左右的英文稿和一段录音', sourceId: 'case-1' },
      { stage: 'short', when: '短期计划', title: '建立每日口语跟读节奏', detail: '每天固定时段跟读二十分钟高频问题，周末回听录音并修改回答。',
        output: '连续两周每天一条跟读记录', sourceId: 'case-1',
        fallback: { trigger: '连续三天没有完成练习', detail: '把每次练习缩短到十分钟，并绑定在通勤或饭后这类固定动作上。' } },
      { stage: 'before', when: '投递简历前', title: '完成两次模拟面试', detail: '用 STAR 结构讲两个项目经历，请朋友或社群伙伴提问，并记录卡住的题目。',
        output: '一份卡住问题清单', sourceId: 'case-2',
        fallback: { trigger: '找不到陪练', detail: '改用录音加自评表，对照清单逐题打分，再约一次线上模拟。' } },
      { stage: 'after', when: '面试通过后', title: '整理入职前的准备清单', detail: '把面试中被追问的内容整理成笔记，并提前熟悉岗位常用的英文术语。',
        output: '一份术语表和三条复盘笔记', sourceId: 'case-3',
        fallback: { trigger: '面试没有通过', detail: '按卡住的题目做一次复盘，补练后再申请同类岗位。' } },
    ],
  };
}
