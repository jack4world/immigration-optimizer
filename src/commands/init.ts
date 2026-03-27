import { input, select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { loadConfig, saveConfig } from '../data/config.js';
import { scaffoldPathway } from '../data/pathway.js';
import { SEED_PROGRAMS } from '../data/seed-programs.js';
import { createProvider } from '../llm/factory.js';
import { generateProfileYaml, type InitAnswers } from '../generators/constraints.js';
import { generateRubrics } from '../generators/rubrics.js';
import { generatePathway } from '../generators/plan.js';
import { generateProgram } from '../generators/program.js';
import { calculateCRS, ieltsToClb } from '../crs/calculator.js';
import { parseProfileYaml } from '../generators/constraints.js';
import { t, setLanguage, getLlmLanguageInstruction, type Language } from '../i18n.js';
import { parseJsonResponse } from '../llm/json-parser.js';
import type { ApplicantProfile } from '../data/schemas.js';

function buildInterviewPrompt(profile: ApplicantProfile): string {
  const langInstruction = getLlmLanguageInstruction();
  return `You are a Canadian immigration consultant conducting a brief interview.
Based on the applicant's profile below, generate 3-5 follow-up questions
to understand their situation and goals better.

Ask about things the structured data DOESN'T capture:
- Specific reasons for choosing Canada (family reunion? career? education?)
- Flexibility on destination city/province
- Career goals after landing
- Family situation details (spouse skills, children's education needs)
- Any pending applications or previous immigration attempts
- Connections in Canada (friends, former colleagues, community)

Do NOT ask about things already answered.
Do NOT ask more than 5 questions.

## Applicant Profile
Name: ${profile.personal.name}
Age: ${profile.personal.age}, ${profile.personal.nationality}
Education: ${profile.education.highest_degree} in ${profile.education.field_of_study}
Occupation: ${profile.work_experience.current_occupation}
Target: ${profile.preferences.target_provinces.join(', ')}
Timeline: ${profile.preferences.timeline_urgency}

Return a JSON array of question strings:
["question 1", "question 2", ...]${langInstruction}`;
}

async function collectAnswers(name: string): Promise<InitAnswers> {
  const personalName = await input({ message: t('profile.name') });
  const nationality = await input({ message: t('profile.nationality'), default: 'Chinese' });
  const age = await input({ message: t('profile.age') });
  const dob = await input({ message: t('profile.dob') });
  const marital = await select({
    message: t('profile.marital'),
    choices: [
      { value: 'single', name: 'Single / 单身' },
      { value: 'married', name: 'Married / 已婚' },
      { value: 'common_law', name: 'Common-law / 同居伴侣' },
    ],
  });
  const hasChildren = await confirm({ message: t('profile.children'), default: false });

  const degree = await select({
    message: t('edu.degree'),
    choices: [
      { value: 'high_school', name: 'High school / 高中' },
      { value: 'one_year_diploma', name: '1-year diploma / 一年制大专' },
      { value: 'two_year_diploma', name: '2-year diploma / 两年制大专' },
      { value: 'bachelors', name: 'Bachelor\'s / 本科' },
      { value: 'two_or_more_credentials', name: '2+ credentials / 双学历' },
      { value: 'masters', name: 'Master\'s / 硕士' },
      { value: 'phd', name: 'PhD / 博士' },
    ],
  });
  const field = await input({ message: t('edu.field') });
  const institution = await input({ message: t('edu.institution') });
  const eduCountry = await input({ message: t('edu.country'), default: 'China' });
  const yearCompleted = await input({ message: t('edu.year') });
  const ecaCompleted = await confirm({ message: t('edu.eca'), default: false });

  const testType = await select({
    message: t('lang.test_type'),
    choices: [
      { value: 'IELTS', name: 'IELTS' },
      { value: 'CELPIP', name: 'CELPIP' },
      { value: 'none', name: 'None / 无' },
    ],
  });

  let engReading = 0, engWriting = 0, engListening = 0, engSpeaking = 0;
  if (testType !== 'none') {
    const r = await input({ message: `${testType} ${t('lang.reading')}` });
    const w = await input({ message: `${testType} ${t('lang.writing')}` });
    const l = await input({ message: `${testType} ${t('lang.listening')}` });
    const s = await input({ message: `${testType} ${t('lang.speaking')}` });

    if (testType === 'IELTS') {
      engReading = ieltsToClb(parseFloat(r));
      engWriting = ieltsToClb(parseFloat(w));
      engListening = ieltsToClb(parseFloat(l));
      engSpeaking = ieltsToClb(parseFloat(s));
    } else {
      engReading = parseInt(r, 10);
      engWriting = parseInt(w, 10);
      engListening = parseInt(l, 10);
      engSpeaking = parseInt(s, 10);
    }
  }

  const hasFrench = await confirm({ message: t('lang.has_french'), default: false });
  let frReading = 0, frWriting = 0, frListening = 0, frSpeaking = 0;
  if (hasFrench) {
    frReading = parseInt(await input({ message: 'French Reading (CLB):' }), 10);
    frWriting = parseInt(await input({ message: 'French Writing (CLB):' }), 10);
    frListening = parseInt(await input({ message: 'French Listening (CLB):' }), 10);
    frSpeaking = parseInt(await input({ message: 'French Speaking (CLB):' }), 10);
  }

  const occupation = await input({ message: t('work.occupation') });
  const noc = await input({ message: t('work.noc') });
  const teer = await select({
    message: t('work.teer'),
    choices: [
      { value: 0, name: 'TEER 0 (Management / 管理)' },
      { value: 1, name: 'TEER 1 (Professional / 专业)' },
      { value: 2, name: 'TEER 2 (Technical / 技术)' },
      { value: 3, name: 'TEER 3 (Intermediate / 中级)' },
      { value: 4, name: 'TEER 4 (Labour / 劳动)' },
    ],
  });
  const foreignYears = await input({ message: t('work.foreign_years'), default: '0' });
  const canadianYears = await input({ message: t('work.canadian_years'), default: '0' });

  const settlement = await input({ message: t('fin.settlement'), default: '20000' });
  const willInvest = await confirm({ message: t('fin.invest'), default: false });

  const hasOffer = await confirm({ message: t('ties.job_offer'), default: false });
  const hasRelatives = await confirm({ message: t('ties.relatives'), default: false });
  const prevStudy = await confirm({ message: t('ties.prev_study'), default: false });
  const prevWork = await confirm({ message: t('ties.prev_work'), default: false });

  const provinces = await checkbox({
    message: t('pref.provinces'),
    choices: [
      { value: 'Ontario', name: 'Ontario / 安大略' },
      { value: 'British Columbia', name: 'British Columbia / 不列颠哥伦比亚' },
      { value: 'Alberta', name: 'Alberta / 阿尔伯塔' },
      { value: 'Quebec', name: 'Quebec / 魁北克' },
      { value: 'Manitoba', name: 'Manitoba / 曼尼托巴' },
      { value: 'Saskatchewan', name: 'Saskatchewan / 萨斯喀彻温' },
      { value: 'Nova Scotia', name: 'Nova Scotia / 新斯科舍' },
      { value: 'New Brunswick', name: 'New Brunswick / 新不伦瑞克' },
      { value: 'Newfoundland', name: 'Newfoundland / 纽芬兰' },
      { value: 'PEI', name: 'PEI / 爱德华王子岛' },
    ],
  });

  const urgency = await select({
    message: t('pref.urgency'),
    choices: [
      { value: 'asap', name: 'ASAP / 越快越好' },
      { value: 'within_1_year', name: 'Within 1 year / 一年以内' },
      { value: 'within_2_years', name: 'Within 2 years / 两年以内' },
      { value: 'flexible', name: 'Flexible / 不着急' },
    ],
  });

  const risk = await select({
    message: t('pref.risk'),
    choices: [
      { value: 'low', name: 'Low (safest route only) / 低（只走最稳路线）' },
      { value: 'medium', name: 'Medium (some uncertainty OK) / 中（可接受不确定性）' },
      { value: 'high', name: 'High (willing to try new programs) / 高（愿意尝试新项目）' },
    ],
  });

  const willStudy = await confirm({ message: t('pref.study'), default: false });
  const willRelocate = await confirm({ message: t('pref.relocate'), default: true });
  const antiRaw = await input({ message: t('pref.anti'), default: '' });
  const antiPatterns = antiRaw ? antiRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  return {
    name,
    nationality,
    age: parseInt(age, 10),
    date_of_birth: dob,
    marital_status: marital as 'single' | 'married' | 'common_law',
    has_children: hasChildren,
    highest_degree: degree,
    field_of_study: field,
    institution,
    edu_country: eduCountry,
    year_completed: parseInt(yearCompleted, 10),
    eca_completed: ecaCompleted,
    primary_test: testType as 'IELTS' | 'CELPIP' | 'none',
    english_reading: engReading,
    english_writing: engWriting,
    english_listening: engListening,
    english_speaking: engSpeaking,
    has_french: hasFrench,
    french_reading: frReading,
    french_writing: frWriting,
    french_listening: frListening,
    french_speaking: frSpeaking,
    current_occupation: occupation,
    noc_code: noc,
    teer_category: teer,
    foreign_years: parseInt(foreignYears, 10),
    canadian_years: parseInt(canadianYears, 10),
    settlement_funds_cad: parseInt(settlement, 10),
    willing_to_invest: willInvest,
    has_job_offer: hasOffer,
    relatives_in_canada: hasRelatives,
    previous_study: prevStudy,
    previous_work: prevWork,
    target_provinces: provinces.length > 0 ? provinces : ['Ontario'],
    timeline_urgency: urgency,
    risk_tolerance: risk,
    willing_to_study: willStudy,
    willing_to_relocate: willRelocate,
    anti_patterns: antiPatterns,
    user_notes: '',
  };
}

export async function initCommand(name: string): Promise<void> {
  const config = loadConfig();

  const lang = await select({
    message: t('init.language'),
    choices: [
      { value: 'zh', name: '中文（简体）' },
      { value: 'en', name: 'English' },
    ],
    default: config.language || 'zh',
  }) as Language;

  setLanguage(lang);
  config.language = lang;
  saveConfig(config);

  console.log(chalk.bold(`\n  ${t('init.title')}: ${name}\n`));

  if (!config.model_override) {
    const wantOverride = await select({
      message: t('init.model_override'),
      choices: [
        { value: 'no', name: t('init.model_override_no') },
        { value: 'yes', name: t('init.model_override_yes') },
      ],
    });

    if (wantOverride === 'yes') {
      const model = await input({ message: t('init.model_name'), validate: v => v.length > 0 || 'Required' });
      const baseUrl = await input({ message: t('init.model_base_url'), validate: v => v.startsWith('http') || 'Must be a URL' });
      const apiKey = await input({ message: t('init.model_api_key'), validate: v => v.length > 0 || 'Required' });
      config.model_override = { provider_type: 'openai-compatible', model, base_url: baseUrl, api_key: apiKey };
      saveConfig(config);
      console.log(chalk.green(`\n  ${t('init.model_saved')}`));
      console.log(chalk.yellow(`  ${t('init.model_note')}\n`));
    }
  }

  const useVertex = !!(process.env.CLAUDE_CODE_USE_VERTEX === '1' || process.env.GOOGLE_CLOUD_PROJECT);
  if (!config.model_override && !useVertex && !config.api_key) {
    const apiKey = await input({ message: t('init.api_key'), validate: v => v.length > 0 || 'Required' });
    config.api_key = apiKey;
    saveConfig(config);
  }

  const answers = await collectAnswers(name);
  const profileYaml = generateProfileYaml(answers);
  const profile = parseProfileYaml(profileYaml);

  const crs = calculateCRS(profile);
  console.log(chalk.bold(`\n  ${t('progress.crs_estimate')} ${crs.total}`));
  console.log(`  Age: ${crs.details.age} | Education: ${crs.details.education} | Language: ${crs.details.first_language}`);
  console.log(`  Canadian exp: ${crs.details.canadian_experience} | Skill transfer: ${crs.skill_transferability}`);
  console.log(`  Additional: ${crs.additional_points}\n`);

  let provider;
  try {
    provider = createProvider(config);
  } catch (err) {
    console.log(chalk.red(`\n  ${t('error.provider_fail')}: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }

  // Follow-up interview
  const interviewSpinner = ora(t('interview.generating')).start();
  try {
    const interviewPrompt = buildInterviewPrompt(profile);
    const questionsRaw = await provider.complete(interviewPrompt, 2000);
    const questions = parseJsonResponse(questionsRaw);
    interviewSpinner.succeed(t('interview.intro'));

    if (Array.isArray(questions) && questions.length > 0) {
      const interviewAnswers: string[] = [];
      for (const q of questions.slice(0, 5)) {
        if (typeof q !== 'string') continue;
        const answer = await input({ message: q });
        if (answer.trim()) {
          interviewAnswers.push(`Q: ${q}\nA: ${answer.trim()}`);
        }
      }
      if (interviewAnswers.length > 0) {
        answers.user_notes = interviewAnswers.join('\n\n');
      }
    }
  } catch {
    interviewSpinner.warn('Follow-up questions skipped (LLM unavailable)');
  }

  const spinner = ora(t('progress.generating_rubrics')).start();
  let rubricsYaml: string;
  try {
    rubricsYaml = await generateRubrics(provider, profile, crs);
    spinner.succeed(t('progress.rubrics_done'));
  } catch (err) {
    spinner.fail(t('progress.rubrics_fail'));
    console.log(chalk.red(`\n  ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }

  spinner.start(t('progress.generating_pathway'));
  let pathwayMd: string;
  try {
    pathwayMd = await generatePathway(provider, profile, crs, SEED_PROGRAMS);
    spinner.succeed(t('progress.pathway_done'));
  } catch (err) {
    spinner.fail(t('progress.pathway_fail'));
    console.log(chalk.red(`\n  ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }

  const programMd = generateProgram(profile, config);
  const programsDbJson = JSON.stringify(SEED_PROGRAMS, null, 2);

  const dirName = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
  const projectDir = path.resolve(dirName);

  if (fs.existsSync(projectDir)) {
    const overwrite = await confirm({ message: `Directory "${dirName}" already exists. Overwrite?`, default: false });
    if (!overwrite) {
      console.log(chalk.yellow('\n  Aborted.\n'));
      return;
    }
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  spinner.start(t('progress.creating_project'));
  await scaffoldPathway(projectDir, {
    profile: profileYaml,
    rubrics: rubricsYaml,
    pathway: pathwayMd,
    program: programMd,
    programsDb: programsDbJson,
  });
  spinner.succeed(`${t('progress.project_created')} ${chalk.bold(dirName)}/`);

  console.log(`
  ${chalk.green(t('next.title'))}
    cd ${dirName}
    ${chalk.dim(t('next.review'))}
    immigration-optimizer run
`);
}
