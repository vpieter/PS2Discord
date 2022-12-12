import { ps2MainOutfit, runningActivities } from '../../app';
import { DiscordGuildId, DiscordCategoryIdOps, DiscordChannelIdOpsLobby, DiscordChannelIdMentoring, Activities } from '../../consts';
import { getDiscordMention, wait } from '../../utils';
import { ChannelType, Client as DiscordClient, EmbedBuilder, Guild as DiscordGuild, Snowflake, TextChannel, VoiceChannel, VoiceState } from 'discord.js';
import { DateTime, Interval } from 'luxon';

enum Status {
  'Ready',
  'Started',
  'Stopped',
}

export class TrainingTracker {
  private _readyPromise: Promise<this>;
  private _discordClient: DiscordClient;
  private _discordGuild: DiscordGuild;
  private _channel: TextChannel | null = null;
  private _voiceChannels: Array<VoiceChannel> = [];
  private _participantDiscordIds: Array<string> = [];
  private _startTime: DateTime | null = null;
  private _stopTime: DateTime | null = null;
  private _autoStopper: NodeJS.Timer | null = null;

  get ready(): Promise<this> {
    if (this._channel !== null) return new Promise(resolve => resolve(this));
    return this._readyPromise;
  }

  get started(): boolean {
    return !!this._startTime;
  }

  get stopped(): boolean {
    return !!this._startTime && !!this._stopTime;
  }

  get status(): string {
    return Object.values(Status)[this._statusKey] as string;
  }

  private get _statusKey(): number {
    if (!this.started) return Status.Ready;
    if (this.started && !this.stopped) return Status.Started
    return Status.Stopped;
  }

  private get _voiceIsEmpty(): boolean {
    if (!this.started || this.stopped) return false;

    return this._voiceChannels.every(voiceChannel => voiceChannel.members.size === 0);
  }

  constructor(discordClient: DiscordClient, discordGuild: DiscordGuild) {
    this._readyPromise = Promise.all([
      discordClient.channels.fetch(DiscordChannelIdMentoring).then(channel => {
        if (!channel) throw(`Unexpected null channel (${DiscordChannelIdMentoring}).`);
        if (channel.type !== ChannelType.GuildText) throw('Training channel should be a text channel.');
        this._channel = channel as TextChannel;
        return this._channel;
      }),
    ]).then(() => this);
    this._discordClient = discordClient;
    this._discordGuild = discordGuild;
  }

  async start() {
    if (this.started) throw('Training has already started.');

    if (this._channel === null) {
      await this.ready.then(async () => await this.start());
      return;
    }

    this._startTime = DateTime.local();

    this._discordClient.on('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._voiceChannels.push(await this._createChannel('Alpha', 12));
    this._voiceChannels.push(await this._createChannel('Bravo', 12));
    this._voiceChannels.push(await this._createChannel('Charlie', 12));
    this._voiceChannels.push(await this._createChannel('Delta', 12));
  }

  async stop() {
    if (!this.started) throw('Training has not started yet.');
    if (this.stopped) throw('Training has already stopped.');

    if (!this._channel) throw('Unexpected training _channel null.');

    if (this._autoStopper) clearTimeout(this._autoStopper);
    this._discordClient.removeListener('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._stopTime = DateTime.local();

    await this._channel.send({embeds: [this._generateReport()]});
    await this._removeChannels(DiscordChannelIdOpsLobby);
  }

  // private methods
  private _voiceStatusUpdateListener = (oldState: VoiceState, newState: VoiceState) => {
    if (newState.guild.id !== DiscordGuildId) return;

    // Check inactivity
    if (!this._startTime) throw('Unexpected training _startTime null.');
    const duration = Interval.fromDateTimes(this._startTime, DateTime.local()).toDuration();
    const timeoutMinutes = (duration.minutes > 10 ? 5 : 15);
    if (this._voiceIsEmpty && !this._autoStopper) {
      this._autoStopper = setTimeout(this._autoStopperCallback, timeoutMinutes * 60 * 1000);
    }

    // Track participants
    if (newState.channelId === null || newState.member === null) return;
    if (!this._voiceChannels.some(channel => channel.id === newState.channelId)) return;
    if (this._participantDiscordIds.some(participantId => participantId === newState.member?.id)) return;
    this._participantDiscordIds.push(newState.member.id);
  }

  private _autoStopperCallback = async () => {
    this._autoStopper = null;
    if (this._stopTime) return;
    if (!this._voiceIsEmpty) return;

    await this.stop();
    // TODO: This isn't the tracker's responsibility :/
    delete runningActivities[Activities.Training];
  }

  private _createChannel = async (squadName: string, userLimit: number) => {
    return await this._discordGuild.channels.create({ name: `Training ${squadName}`, type: ChannelType.GuildVoice, userLimit: userLimit, parent: DiscordCategoryIdOps });
  }

  private _removeChannels = async (moveChannelId: Snowflake) => {
    this._voiceChannels.forEach(async voiceChannel => {
      if (!voiceChannel.deletable) throw(`Can't delete training voice channel.`);

      voiceChannel.members.forEach(async member => {
        await member.voice.setChannel(moveChannelId, 'The training has ended.');
      });

      wait(15000).then(async () => { await voiceChannel.delete(); });
    });
  }

  private _generateReport = () => {
    if (!this._startTime || !this._stopTime) throw('Training has not stopped yet.');

    const participantNames = this._participantDiscordIds.length
        ? this._participantDiscordIds.map(participantId => getDiscordMention(participantId)).join(', ')
        : 'No one joined the training voice channels.';

    const duration = Interval.fromDateTimes(this._startTime, this._stopTime).toDuration();
    const reportEmbed = new EmbedBuilder()
      .setTitle(`[${ps2MainOutfit.alias}] ${ps2MainOutfit.name} training report.`)
      .addFields([
        { name: `${this._participantDiscordIds.length} Participants:`, value: participantNames, inline: false },
        { name: 'Duration', value: `${duration.toFormat('hh:mm:ss')}`, inline: true },
      ]);

    return reportEmbed;
  }
}
