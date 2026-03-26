import { describe, it, expect } from 'vitest';
import { buildRubricText, buildDimensionPrompt, buildCriticPrompt, buildHolisticPrompt, buildComparativePrompt } from '../../src/scoring/prompts.js';
import type { Dimension, Rubrics, ProgramsDB } from '../../src/data/schemas.js';

const sampleDim: Dimension = {
  weight: 0.30,
  sub_dimensions: {
    crs_competitiveness: {
      description: 'CRS score relative to recent draw cutoffs',
      anchors: { 60: 'CRS 20+ below cutoff', 80: 'CRS at or above cutoff', 90: 'CRS 30+ above cutoff' },
    },
    program_eligibility: {
      description: 'Whether all eligibility requirements are met',
      anchors: { 60: 'Missing 1-2 key requirements', 90: 'Exceeds all requirements' },
    },
  },
};

describe('buildRubricText', () => {
  it('formats sub-dimensions with sorted anchors', () => {
    const text = buildRubricText(sampleDim);
    expect(text).toContain('### crs_competitiveness');
    expect(text).toContain('### program_eligibility');
    expect(text).toContain('60:');
    expect(text).toContain('90:');
  });

  it('includes descriptions', () => {
    const text = buildRubricText(sampleDim);
    expect(text).toContain('CRS score relative to recent draw cutoffs');
  });
});

describe('buildDimensionPrompt', () => {
  it('includes dimension name, pathway, and rubric', () => {
    const prompt = buildDimensionPrompt('success_probability', sampleDim, 'Step 1: IELTS exam');
    expect(prompt).toContain('success_probability');
    expect(prompt).toContain('Step 1: IELTS exam');
    expect(prompt).toContain('crs_competitiveness');
    expect(prompt).toContain('program_eligibility');
  });

  it('requests JSON with sub-dimension keys', () => {
    const prompt = buildDimensionPrompt('success_probability', sampleDim, 'pathway');
    expect(prompt).toContain('"crs_competitiveness"');
    expect(prompt).toContain('"program_eligibility"');
    expect(prompt).toContain('"score"');
  });
});

describe('buildCriticPrompt', () => {
  it('includes penalty rules and pathway', () => {
    const rubrics: Rubrics = {
      dimensions: {},
      adversarial_penalties: {
        eligibility: [{ rule: 'CLB below requirement', penalty: -20 }],
        max_penalty_per_dimension: -25,
      } as Rubrics['adversarial_penalties'],
    };
    const prompt = buildCriticPrompt('Step 1: IELTS', {} as ProgramsDB, rubrics);
    expect(prompt).toContain('CLB below requirement');
    expect(prompt).toContain('Step 1: IELTS');
    expect(prompt).toContain('ELIGIBILITY');
  });
});

describe('buildHolisticPrompt', () => {
  it('includes all dimension scores', () => {
    const scores = {
      success_probability: { score: 85, weight: 0.3, sub_dimensions: { crs: { score: 85 } } },
      timeline_efficiency: { score: 70, weight: 0.25, sub_dimensions: { duration: { score: 70 } } },
    };
    const prompt = buildHolisticPrompt(scores);
    expect(prompt).toContain('success_probability: 85.0');
    expect(prompt).toContain('timeline_efficiency: 70.0');
  });
});

describe('buildComparativePrompt', () => {
  it('includes both pathways and mutation', () => {
    const rubrics: Rubrics = {
      dimensions: {
        success_probability: { weight: 0.3, sub_dimensions: { crs: { description: 'test', anchors: {} } } },
      },
      adversarial_penalties: {},
    };
    const prompt = buildComparativePrompt('old pathway', 'new pathway', 'SWAP_PROGRAM: switched to CEC', rubrics);
    expect(prompt).toContain('old pathway');
    expect(prompt).toContain('new pathway');
    expect(prompt).toContain('SWAP_PROGRAM: switched to CEC');
    expect(prompt).toContain('success_probability.crs');
  });
});
