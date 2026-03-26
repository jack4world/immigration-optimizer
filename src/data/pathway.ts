import fs from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';

export interface PathwayFiles {
  profile: string;
  rubrics: string;
  pathway: string;
  program: string;
  programsDb: string;
}

const GITIGNORE = `results.tsv
score_history.jsonl
node_modules/
`;

export async function scaffoldPathway(dir: string, files: PathwayFiles): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'profile.yaml'), files.profile);
  fs.writeFileSync(path.join(dir, 'rubrics.yaml'), files.rubrics);
  fs.writeFileSync(path.join(dir, 'pathway.md'), files.pathway);
  fs.writeFileSync(path.join(dir, 'program.md'), files.program);
  fs.writeFileSync(path.join(dir, 'programs_db.json'), files.programsDb);
  fs.writeFileSync(path.join(dir, '.gitignore'), GITIGNORE);

  const git = simpleGit(dir);
  await git.init();
  await git.add('-A');
  await git.commit('Initial immigration pathway scaffold');
}
