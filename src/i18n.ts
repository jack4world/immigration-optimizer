export type Language = 'en' | 'zh';

const messages = {
  'init.title': { en: 'immigration-optimizer', zh: 'immigration-optimizer' },
  'init.language': { en: 'Language / 语言:', zh: '语言 / Language:' },
  'init.first_time': { en: 'Let\'s set up your applicant profile.', zh: '让我们设置您的申请人档案。' },
  'init.vertex_detected': { en: 'Using Vertex AI (detected from environment).', zh: '使用 Vertex AI（从环境变量检测）。' },
  'init.api_key': { en: 'Anthropic API key:', zh: 'Anthropic API 密钥：' },
  'init.api_key_saved': { en: 'API key saved.', zh: 'API 密钥已保存。' },
  'init.api_key_required': { en: 'API key is required', zh: 'API 密钥为必填项' },
  'init.model_override': { en: 'Use a different LLM? (e.g., Kimi, DeepSeek)', zh: '使用其他大模型？（如 Kimi、DeepSeek）' },
  'init.model_override_yes': { en: 'Yes, configure a custom model', zh: '是，配置自定义模型' },
  'init.model_override_no': { en: 'No, use default', zh: '否，使用默认' },
  'init.model_name': { en: 'Model name:', zh: '模型名称：' },
  'init.model_base_url': { en: 'API base URL:', zh: 'API 地址：' },
  'init.model_api_key': { en: 'API key for this model:', zh: '该模型的 API 密钥：' },
  'init.model_saved': { en: 'Custom model configured.', zh: '自定义模型已配置。' },
  'init.model_removed': { en: 'Custom model removed.', zh: '自定义模型已移除。' },
  'init.model_keep_or_change': { en: 'Custom model settings:', zh: '自定义模型设置：' },
  'init.model_keep': { en: 'Keep current settings', zh: '保持当前设置' },
  'init.model_edit': { en: 'Edit model / API key / URL', zh: '编辑模型 / API 密钥 / 地址' },
  'init.model_remove': { en: 'Remove custom model (use default)', zh: '移除自定义模型（使用默认）' },
  'init.model_note': { en: 'Note: Custom models only work in standalone mode.', zh: '注意：自定义模型仅在独立模式下运行。' },

  // Applicant profile
  'profile.name': { en: 'Full name:', zh: '姓名：' },
  'profile.nationality': { en: 'Nationality:', zh: '国籍：' },
  'profile.age': { en: 'Age:', zh: '年龄：' },
  'profile.dob': { en: 'Date of birth (YYYY-MM-DD):', zh: '出生日期（YYYY-MM-DD）：' },
  'profile.marital': { en: 'Marital status:', zh: '婚姻状况：' },
  'profile.children': { en: 'Do you have children?', zh: '有子女吗？' },

  // Education
  'edu.degree': { en: 'Highest education level:', zh: '最高学历：' },
  'edu.field': { en: 'Field of study:', zh: '专业领域：' },
  'edu.institution': { en: 'Institution:', zh: '毕业院校：' },
  'edu.country': { en: 'Country of education:', zh: '学校所在国家：' },
  'edu.year': { en: 'Year completed:', zh: '毕业年份：' },
  'edu.eca': { en: 'ECA (WES) completed?', zh: '是否已完成学历认证（ECA/WES）？' },

  // Language
  'lang.test_type': { en: 'English language test:', zh: '英语考试类型：' },
  'lang.reading': { en: 'Reading score:', zh: 'Reading 分数：' },
  'lang.writing': { en: 'Writing score:', zh: 'Writing 分数：' },
  'lang.listening': { en: 'Listening score:', zh: 'Listening 分数：' },
  'lang.speaking': { en: 'Speaking score:', zh: 'Speaking 分数：' },
  'lang.has_french': { en: 'Do you have French test scores?', zh: '有法语成绩吗？' },

  // Work
  'work.occupation': { en: 'Current occupation:', zh: '当前职位：' },
  'work.noc': { en: 'NOC code (e.g., 21232):', zh: 'NOC代码（如21232）：' },
  'work.teer': { en: 'TEER category:', zh: 'TEER类别：' },
  'work.foreign_years': { en: 'Years of foreign work experience:', zh: '海外工作经验（年）：' },
  'work.canadian_years': { en: 'Years of Canadian work experience:', zh: '加拿大工作经验（年）：' },

  // Finances
  'fin.settlement': { en: 'Settlement funds (CAD):', zh: '可证明安家资金（CAD）：' },
  'fin.invest': { en: 'Willing to invest for immigration?', zh: '愿意走投资移民吗？' },

  // Canadian ties
  'ties.job_offer': { en: 'Do you have a Canadian job offer?', zh: '有加拿大雇主Offer吗？' },
  'ties.relatives': { en: 'Relatives in Canada?', zh: '有加拿大亲属吗？' },
  'ties.prev_study': { en: 'Previous study in Canada?', zh: '曾在加拿大留学？' },
  'ties.prev_work': { en: 'Previous work in Canada?', zh: '曾在加拿大工作？' },

  // Preferences
  'pref.provinces': { en: 'Target provinces (select multiple):', zh: '目标省份（可多选）：' },
  'pref.urgency': { en: 'Timeline urgency:', zh: '时间紧迫度：' },
  'pref.risk': { en: 'Risk tolerance:', zh: '风险承受能力：' },
  'pref.study': { en: 'Willing to study as immigration pathway?', zh: '愿意通过留学作为移民途径吗？' },
  'pref.relocate': { en: 'Willing to relocate to non-preferred province for PNP?', zh: '愿意为PNP搬到非首选省份吗？' },
  'pref.anti': { en: 'Things you want to avoid (comma-separated):', zh: '不愿做的事（逗号分隔）：' },

  // Progress
  'progress.generating_rubrics': { en: 'Generating scoring rubrics...', zh: '正在生成评分标准...' },
  'progress.rubrics_done': { en: 'Scoring rubrics generated', zh: '评分标准已生成' },
  'progress.rubrics_fail': { en: 'Failed to generate scoring rubrics', zh: '评分标准生成失败' },
  'progress.generating_pathway': { en: 'Generating initial immigration pathway...', zh: '正在生成初始移民路径...' },
  'progress.pathway_done': { en: 'Initial pathway generated', zh: '初始移民路径已生成' },
  'progress.pathway_fail': { en: 'Failed to generate initial pathway', zh: '初始移民路径生成失败' },
  'progress.creating_project': { en: 'Creating immigration project...', zh: '正在创建移民项目...' },
  'progress.project_created': { en: 'Immigration project created at', zh: '移民项目已创建于' },
  'progress.crs_estimate': { en: 'CRS Estimate:', zh: 'CRS估算分数：' },

  // Next steps
  'next.title': { en: 'Next steps:', zh: '下一步：' },
  'next.review': { en: '# Review profile.yaml and rubrics.yaml', zh: '# 查看 profile.yaml 和 rubrics.yaml' },

  // Interview
  'interview.generating': { en: 'Generating follow-up questions...', zh: '正在生成后续问题...' },
  'interview.intro': { en: 'A few questions to understand your situation better:', zh: '几个问题，帮助更好了解您的情况：' },

  // Errors
  'error.provider_fail': { en: 'Failed to create LLM provider', zh: 'LLM 提供者创建失败' },
  'error.model_check': { en: 'Check that your model is available', zh: '请检查您的模型是否可用' },
  'error.auth_check': { en: 'Check authentication: run "gcloud auth application-default login"', zh: '请检查认证：运行 "gcloud auth application-default login"' },
} as const;

type MessageKey = keyof typeof messages;

let currentLanguage: Language = 'zh';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: MessageKey): string {
  const entry = messages[key];
  return entry[currentLanguage] || entry.en;
}

export function getLlmLanguageInstruction(): string {
  if (currentLanguage === 'zh') {
    return '\n\nIMPORTANT: Generate ALL output in Chinese (Simplified Chinese / 简体中文). All descriptions, recommendations, and commentary must be written in Chinese.';
  }
  return '';
}
