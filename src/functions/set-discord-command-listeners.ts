import { discordBotUser, discordClient } from '../app';
import { Commands } from '../consts';
import { Command } from '../types';
import { CommandHandlers } from '../discord-command-handlers';
import { isFunction, keys } from 'lodash';
import XRegExp from 'xregexp';

export async function setDiscordCommandListeners(): Promise<void> {
  discordClient.on('message', async message => {
    // TODO: Param is limited to [A-Za-z0-9]
    const regexString = `^(?:(?:(?<mention><@!${discordBotUser.id}>)\\s*!?)|!?)(?<commandName>${keys(Commands).join('|')})\\s*(?<param>[A-Za-z0-9]+)?\\s*$`;
    const regex = XRegExp(regexString, 'i');
    const result = XRegExp.exec(message.content, regex);
    if (result === null) return;

    const { mention=null, commandName=null, param=null } = result;
    if (message.channel.type !== 'dm' && mention === null) return;
    if (commandName === null) return;

    const command: Command = { mention, commandName, param, message };
    const handler = (CommandHandlers as any)[command.commandName];
    if (isFunction(handler)) handler(command);
  });
  return Promise.resolve();
};
