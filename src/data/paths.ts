import path from 'path';
import os from 'os';

export function getGlobalDir(): string {
  return path.join(os.homedir(), '.immigration-optimizer');
}

export function getConfigPath(): string {
  return path.join(getGlobalDir(), 'config.json');
}

export function getProfilePath(): string {
  return path.join(getGlobalDir(), 'profile.json');
}
