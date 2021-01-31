export function consoleCatch(e: any) {
  if (e === undefined) return;
  console.error(e);
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

export function wait<T> (ms: number, value?: T) {
  return new Promise<T>((resolve) => setTimeout(resolve, ms, value));
};
