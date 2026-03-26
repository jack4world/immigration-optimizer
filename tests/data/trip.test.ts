import { describe, it, expect, afterEach } from 'vitest';
import { scaffoldPathway } from '../../src/data/pathway.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('scaffoldPathway', () => {
  const testDir = path.join(os.tmpdir(), 'imm-scaffold-' + Date.now());

  afterEach(() => fs.rmSync(testDir, { recursive: true, force: true }));

  it('creates pathway directory with all required files', async () => {
    const dir = path.join(testDir, 'case-001');
    await scaffoldPathway(dir, {
      profile: 'personal:\n  name: test',
      rubrics: 'dimensions: {}',
      pathway: '# Step 1\nIELTS',
      program: '# Agent Instructions',
      programsDb: '{}',
    });

    expect(fs.existsSync(path.join(dir, 'profile.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'rubrics.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'pathway.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'program.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'programs_db.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.gitignore'))).toBe(true);
  });

  it('writes correct programs_db.json', async () => {
    const dir = path.join(testDir, 'case-002');
    await scaffoldPathway(dir, {
      profile: 'personal:\n  name: test',
      rubrics: 'dimensions: {}',
      pathway: '# Step 1',
      program: '# Instructions',
      programsDb: '{"ee_fswp": {"id": "ee_fswp"}}',
    });

    const db = JSON.parse(fs.readFileSync(path.join(dir, 'programs_db.json'), 'utf-8'));
    expect(db.ee_fswp.id).toBe('ee_fswp');
  });

  it('initializes git repo with initial commit', async () => {
    const dir = path.join(testDir, 'case-003');
    await scaffoldPathway(dir, {
      profile: 'personal:\n  name: test',
      rubrics: 'dimensions: {}',
      pathway: '# Step 1',
      program: '# Instructions',
      programsDb: '{}',
    });

    expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);
  });

  it('writes correct file contents', async () => {
    const dir = path.join(testDir, 'case-004');
    await scaffoldPathway(dir, {
      profile: 'personal:\n  name: Zhang San',
      rubrics: 'dimensions:\n  success: {}',
      pathway: '# Step 1\nIELTS exam',
      program: '# Optimize pathway',
      programsDb: '{}',
    });

    expect(fs.readFileSync(path.join(dir, 'profile.yaml'), 'utf-8')).toBe('personal:\n  name: Zhang San');
    expect(fs.readFileSync(path.join(dir, 'pathway.md'), 'utf-8')).toBe('# Step 1\nIELTS exam');
  });
});
