import { Commands } from '../../consts';
import { Message as DiscordMessage } from 'discord.js';

export type Command = {
  mention: string;
  commandName: Commands;
  param: string;
  message: DiscordMessage;
}
