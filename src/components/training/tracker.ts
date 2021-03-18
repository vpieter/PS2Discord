import { ps2MainOutfit } from '../../app';
import { DiscordGuildId, DiscordCategoryIdOps, DiscordChannelIdOpsLobby } from '../../consts';
import { getDiscordMention, wait } from '../../utils';
import { Client as DiscordClient, Guild as DiscordGuild, Message, MessageEmbed, TextChannel, VoiceChannel, VoiceState } from 'discord.js';
import { DateTime, Interval } from 'luxon';

enum Status {
  'Ready',
  'Started',
  'Stopped',
};

export class TrainingTracker {
  private _discordClient: DiscordClient;
  private _discordGuild: DiscordGuild;
  private _message: Message;
  private _voiceChannels: Array<VoiceChannel> = [];
  private _participantDiscordIds: Array<string> = [];
  private _startTime: DateTime | null = null;
  private _stopTime: DateTime | null = null;

  get started(): boolean {
    return !!this._startTime;
  }

  get stopped(): boolean {
    return !!this._startTime && !!this._stopTime;
  }

  get status(): string {
    return Object.values(Status)[this.statusKey] as string;
  }

  private get statusKey(): number {
    if (!this.started) return Status.Ready;
    if (this.started && !this.stopped) return Status.Started
    return Status.Stopped;
  }

  constructor(discordClient: DiscordClient, discordGuild: DiscordGuild, message: Message) {
    this._discordClient = discordClient;
    this._discordGuild = discordGuild;
    this._message = message;
  }

  async start() {
    if (this.started) throw('Training has already started.');

    this._discordClient.on('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._voiceChannels.push(await this._createChannel('Alpha', 12));
    this._voiceChannels.push(await this._createChannel('Bravo', 12));
    this._voiceChannels.push(await this._createChannel('Charlie', 12));
    this._voiceChannels.push(await this._createChannel('Delta', 12));

    this._startTime = DateTime.local();
  }

  async stop(reportChannel: TextChannel) {
    if (!this.started) throw('Training has not started yet.');
    if (this.stopped) throw('Training has already stopped.');

    this._discordClient.removeListener('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._stopTime = DateTime.local();

    if (this._message.deletable) await this._message.delete({ reason: 'The training has ended.' });
    await reportChannel.send(this._generateReport());
    await this._removeChannels(DiscordChannelIdOpsLobby);
  }

  // private methods
  private _voiceStatusUpdateListener = (oldState: VoiceState, newState: VoiceState) => {
    if (newState.guild.id !== DiscordGuildId) return;
    if (newState.channelID === null || newState.member === null) return;
    if (!this._voiceChannels.some(channel => channel.id === newState.channelID)) return;
    if (this._participantDiscordIds.some(participantId => participantId === newState.member?.id)) return;

    this._participantDiscordIds.push(newState.member.id);
  }

  private _createChannel = async (squadName: string, userLimit: number) => {
    return await this._discordGuild.channels.create(`Training ${squadName}`, { type: 'voice', userLimit: userLimit, parent: DiscordCategoryIdOps });
  }

  private _removeChannels = async (moveChannelId: string) => {
    this._voiceChannels.forEach(async voiceChannel => {
      if (!voiceChannel.deletable) throw(`Can't delete training voice channel.`);

      voiceChannel.members.forEach(async member => {
        await member.voice.setChannel(moveChannelId, 'The training has ended.');
      });

      wait(15000).then(async () => { await voiceChannel.delete('The training has ended.'); });
    });
  }

  private _generateReport = () => {
    if (!this._startTime || !this._stopTime) throw('Training has not stopped yet.');

    const participantNames = this._participantDiscordIds.length
        ? this._participantDiscordIds.map(participantId => getDiscordMention(participantId)).join(', ')
        : 'No one joined the training voice channels.';

    const duration = Interval.fromDateTimes(this._startTime, this._stopTime).toDuration();
    const reportEmbed = new MessageEmbed()
      .setTitle(`[${ps2MainOutfit.alias}] ${ps2MainOutfit.name} training report.`)
      .addField(`${this._participantDiscordIds.length} Participants:`, participantNames, false)
      .addField('Duration', `${duration.toFormat('hh:mm:ss')}`, true);

    return reportEmbed;
  }
}
