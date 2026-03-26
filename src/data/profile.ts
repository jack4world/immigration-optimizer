import fs from 'fs';
import path from 'path';
import { getGlobalDir } from './paths.js';

export interface Profile {
  completed_cases: number;
  last_updated: string;
}

const DEFAULT_PROFILE: Profile = {
  completed_cases: 0,
  last_updated: '',
};

export function loadProfile(dir?: string): Profile {
  const profilePath = path.join(dir ?? getGlobalDir(), 'profile.json');
  if (!fs.existsSync(profilePath)) return { ...DEFAULT_PROFILE };
  return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
}

export function saveProfile(profile: Profile, dir?: string): void {
  const d = dir ?? getGlobalDir();
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'profile.json'), JSON.stringify(profile, null, 2));
}
