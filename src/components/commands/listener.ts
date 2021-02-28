import { Command } from './types';
import { Commands } from './commands';
import { CommandHandlers } from './handlers';
import { isFunction, keys } from 'lodash';
import { Message, Client as DiscordClient } from 'discord.js';
import XRegExp from 'xregexp';

export class DiscordCommandListener {
  private _started: boolean = false;
  private _discordClient: DiscordClient;
  private _commands: string[];

  get started(): boolean {
    return this._started;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;

    this._commands = keys(Commands);
  }

  start() {
    this._discordClient.on('message', this._messageListener);
    this._started = true;
  }

  stop() {
    this._discordClient.removeListener('message', this._messageListener);
    this._started = false;
  }

  // private methods
  private _messageListener = (message: Message) => {
    if (this._discordClient.user === null) return;

    // TODO: Param is limited to [A-Za-z0-9]
    const regexString = `^(?:(?:(?<mention><@!${this._discordClient.user.id}>)\\s*!?)|!?)(?<commandName>${this._commands.join('|')})\\s*(?<param>[A-Za-z0-9]+)?\\s*$`;
    const regex = XRegExp(regexString, 'i');
    const result = XRegExp.exec(message.content, regex);
    if (result === null) return;

    const { mention=null, commandName=null, param=null } = result;
    if (message.channel.type !== 'dm' && mention === null) return;
    if (commandName === null) return;

    const command: Command = { mention, commandName, param, message };
    const handler = CommandHandlers[command.commandName];
    if (isFunction(handler)) handler(command);
  };
};
