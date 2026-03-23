import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProfile, saveProfile } from '../../src/data/profile.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('profile', () => {
  const testDir = path.join(os.tmpdir(), 'imm-opt-test-profile-' + Date.now());

  beforeEach(() => fs.mkdirSync(testDir, { recursive: true }));
  afterEach(() => fs.rmSync(testDir, { recursive: true, force: true }));

  it('returns default profile when no file exists', () => {
    const profile = loadProfile(testDir);
    expect(profile.completed_cases).toBe(0);
    expect(profile.last_updated).toBe('');
  });

  it('saves and loads profile', () => {
    saveProfile({
      completed_cases: 3,
      last_updated: '2026-03-23',
    }, testDir);
    const loaded = loadProfile(testDir);
    expect(loaded.completed_cases).toBe(3);
    expect(loaded.last_updated).toBe('2026-03-23');
  });
});
