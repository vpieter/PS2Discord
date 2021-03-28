import { Message as DiscordMessage } from 'discord.js';
import { Commands } from './commands';

export type Command = {
  discordAuthorId: string;
  commandName: Commands;
  param: string;
  discordMessage?: DiscordMessage;
}
