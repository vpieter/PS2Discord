import { Command } from './types';
import { Commands, DiscordCommands } from './commands';
import { CommandHandlers } from './handlers';
import { isFunction, keys } from 'lodash';
import { Message, Client as DiscordClient, ChannelType } from 'discord.js';
import XRegExp from 'xregexp';
import { discordGuild } from '../../app';
import { DiscordCommandHandlers } from './commands/index';

export class DiscordCommandListener {
  private _started = false;
  private _stopped = false;
  private _discordClient: DiscordClient;
  private _commands: string[];

  get started(): boolean {
    return this._started;
  }

  get stopped(): boolean {
    return this._stopped;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;

    this._commands = keys(Commands);
  }

  async start() {
    Object.values(DiscordCommands).forEach(async (command) => {
      const handler = DiscordCommandHandlers[command];
      if (isFunction(handler?.register)) await handler.register();
    });

    this._discordClient.on('interactionCreate', async interaction => {
      if (!interaction.isCommand()) return;

      const handler = DiscordCommandHandlers[(interaction.commandName as DiscordCommands)];
      if (isFunction(handler?.handle)) await handler.handle(interaction);
    });

    this._discordClient.on('messageCreate', this._messageListener);
    this._started = true;
  }

  handle(command: Command) {
    if (!this.started) throw('DiscordCommandListener has not started yet.');
    if (this.stopped) throw('DiscordCommandListener has already stopped.');

    const handler = CommandHandlers[command.commandName];
    if (isFunction(handler)) handler(command);
  }

  async stop() {
    if (!this.started) throw('DiscordCommandListener has not yet started.');

    const commands = await discordGuild.commands.fetch();
    commands.forEach(async command => {
      await discordGuild.commands.delete(command);
    });

    this._discordClient.removeListener('messageCreate', this._messageListener);
    this._stopped = true;
  }

  // private methods
  private _messageListener = (discordMessage: Message) => {
    if (this._discordClient.user === null) return;

    // TODO: Param is limited to [A-Za-z0-9]
    const regexString = `^(?:(?:(?<mention><@!${this._discordClient.user.id}>)\\s*!?)|!?)(?<commandName>${this._commands.join('|')})\\s*(?<param>[A-Za-z0-9]+)?\\s*$`;
    const regex = XRegExp(regexString, 'i');
    const result = XRegExp.exec(discordMessage.content, regex);
    if (result === null) return;

    const { mention=null, commandName=null, param=null } = result;
    if (discordMessage.channel.type !== ChannelType.DM && mention === null) return;
    if (commandName === null) return;

    const discordAuthorId = discordMessage.author.id;

    const command: Command = { discordAuthorId, commandName, param, discordMessage };
    this.handle(command);
  };
}
