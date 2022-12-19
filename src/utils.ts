// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function voidCatch(reason: any) {
  return;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function consoleCatch(reason: any) {
  if (reason === undefined) return;
  console.error(reason);
  console.trace('consoleCatch:');
}

export function getDiscordMention(id: string, type: 'user' | 'channel' = 'user'): string {
  let prefix: string;
  switch (type) {
    case 'channel': {
      prefix = '#';
      break;
    }
    case 'user':
    default: {
      prefix = '@!';
      break;
    }
  }
  return `<${prefix}${id}>`;
}

export function wait<T>(ms: number, value?: T) {
  return new Promise((resolve) => setTimeout(resolve, ms, value));
}

export type Modify<T, R> = Omit<T, keyof R> & R;
