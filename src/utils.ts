import jsonfile from 'jsonfile';
import { map } from 'lodash';
import { parse } from 'path';
import { TrackedDiscordUser } from './types';

export function voidCatch(reason: any) {
  return;
}

export function consoleCatch(reason: any) {
  if (reason === undefined) return;
  console.error(reason);
};

export function getDiscordMention(id: string, type: 'user' | 'channel' = 'user'): string {
  let prefix: string;
  switch (type) {
    case 'channel': {
      prefix = '#';
      break;
    }
    case 'user':
    default: {
      prefix = '#!';
      break;
    }
  }
  return `<${prefix}${id}>`;
};

export function wait<T>(ms: number, value?: T) {
  return new Promise((resolve) => setTimeout(resolve, ms, value));
};

export async function loadStore<T>(target: T, name: string, mapper?: (raw: T) => T) {
  let temp = await jsonfile.readFile(`./store/${name}.json`, { throws: false }).catch(voidCatch);
  if (temp && mapper) {
    temp = mapper(temp);
  }
  Object.assign(target, temp as T);
}
