import { ps2MainOutfit } from '../../app';
import { DiscordGuildId, DiscordChannelIdWelcome, DiscordChannelIdRules } from '../../consts';
import { consoleCatch, getDiscordMention, voidCatch } from '../../utils';
import { Client as DiscordClient, GuildMember } from 'discord.js';

export class DiscordGreeter {
  private _started: boolean = false;
  private _discordClient: DiscordClient;

  get started(): boolean {
    return this._started;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;
  }

  start() {
    this._discordClient.on('guildMemberAdd', this.guildMemberAddListener);
    this._started = true;
  }

  stop() {
    this._discordClient.removeListener('guildMemberAdd', this.guildMemberAddListener);
    this._started = false;
  }

  // private methods
  private guildMemberAddListener = async (guildMember: GuildMember) => {
    if (guildMember.guild.id !== DiscordGuildId) return;

    await guildMember.send(`Welcome to the ${ps2MainOutfit?.alias ?? 'outfit'} Discord,`
    + `\nPlease start by reading our ${getDiscordMention(DiscordChannelIdRules, 'channel')}. We'll keep it short!`
    + `\n`
    + `\nIf you are applying to join the outfit, please contact a leader or officer.`
    + `\nIf you are part of another outfit, please add the [tag] to your discord nickname.`
    + `\n`
    + `\nFeel free to introduce yourself in ${getDiscordMention(DiscordChannelIdWelcome, 'channel')}.`).catch(consoleCatch);

    await guildMember.send(`To learn more about this bot type "help".`).catch(voidCatch);
  };
}
