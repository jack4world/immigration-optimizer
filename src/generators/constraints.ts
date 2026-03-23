import yaml from 'js-yaml';
import type { ApplicantProfile } from '../data/schemas.js';

export interface InitAnswers {
  name: string;
  nationality: string;
  age: number;
  date_of_birth: string;
  marital_status: 'single' | 'married' | 'common_law';
  has_children: boolean;
  highest_degree: string;
  field_of_study: string;
  institution: string;
  edu_country: string;
  year_completed: number;
  eca_completed: boolean;
  primary_test: 'IELTS' | 'CELPIP' | 'none';
  english_reading: number;
  english_writing: number;
  english_listening: number;
  english_speaking: number;
  has_french: boolean;
  french_reading: number;
  french_writing: number;
  french_listening: number;
  french_speaking: number;
  current_occupation: string;
  noc_code: string;
  teer_category: number;
  foreign_years: number;
  canadian_years: number;
  settlement_funds_cad: number;
  willing_to_invest: boolean;
  has_job_offer: boolean;
  relatives_in_canada: boolean;
  previous_study: boolean;
  previous_work: boolean;
  target_provinces: string[];
  timeline_urgency: string;
  risk_tolerance: string;
  willing_to_study: boolean;
  willing_to_relocate: boolean;
  anti_patterns: string[];
  user_notes: string;
}

export function generateProfileYaml(answers: InitAnswers): string {
  const profile: ApplicantProfile = {
    personal: {
      name: answers.name,
      nationality: answers.nationality,
      age: answers.age,
      date_of_birth: answers.date_of_birth,
      marital_status: answers.marital_status as 'single' | 'married' | 'common_law',
      has_children: answers.has_children,
    },
    education: {
      highest_degree: answers.highest_degree as ApplicantProfile['education']['highest_degree'],
      field_of_study: answers.field_of_study,
      institution: answers.institution,
      country: answers.edu_country,
      year_completed: answers.year_completed,
      has_canadian_credential: false,
      eca_completed: answers.eca_completed,
    },
    language: {
      primary_test: answers.primary_test,
      english: answers.primary_test !== 'none' ? {
        reading: answers.english_reading,
        writing: answers.english_writing,
        listening: answers.english_listening,
        speaking: answers.english_speaking,
      } : null,
      french: answers.has_french ? {
        reading: answers.french_reading,
        writing: answers.french_writing,
        listening: answers.french_listening,
        speaking: answers.french_speaking,
      } : null,
    },
    work_experience: {
      canadian: [],
      foreign: [],
      total_years_canadian: answers.canadian_years,
      total_years_foreign: answers.foreign_years,
      current_occupation: answers.current_occupation,
      noc_code: answers.noc_code,
      teer_category: answers.teer_category as ApplicantProfile['work_experience']['teer_category'],
    },
    finances: {
      settlement_funds_cad: answers.settlement_funds_cad,
      proof_of_funds_available: answers.settlement_funds_cad > 0,
      willing_to_invest: answers.willing_to_invest,
    },
    canadian_ties: {
      has_job_offer: answers.has_job_offer,
      has_lmia: false,
      relatives_in_canada: answers.relatives_in_canada,
      previous_study_in_canada: answers.previous_study,
      previous_work_in_canada: answers.previous_work,
      previous_visit_to_canada: false,
    },
    preferences: {
      target_provinces: answers.target_provinces,
      preferred_city_size: 'any',
      industry_preference: [answers.field_of_study],
      timeline_urgency: answers.timeline_urgency as ApplicantProfile['preferences']['timeline_urgency'],
      risk_tolerance: answers.risk_tolerance as ApplicantProfile['preferences']['risk_tolerance'],
      willing_to_study: answers.willing_to_study,
      willing_to_relocate_province: answers.willing_to_relocate,
      priority_order: ['certainty', 'speed', 'cost', 'quality_of_life'],
      anti_patterns: answers.anti_patterns,
    },
  };

  return yaml.dump(profile, { lineWidth: 120, noRefs: true });
}

export function parseProfileYaml(yamlContent: string): ApplicantProfile {
  return yaml.load(yamlContent) as ApplicantProfile;
}
