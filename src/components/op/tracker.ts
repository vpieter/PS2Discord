import { discordBotUser, ps2MainOutfit, ps2RestClient, ps2Zones } from '../../app';
import { DiscordCategoryIdOps, DiscordChannelIdOpsLobby, DiscordChannelIdOps, DiscordChannelIdOpsDebrief } from '../../consts';
import { getDiscordMention, wait } from '../../utils';
import { Client as DiscordClient, Guild as DiscordGuild, Message, MessageEmbed, TextChannel, User, VoiceChannel } from 'discord.js';
import { DateTime, Interval } from 'luxon';
import { DeathDto, GainExperienceDto } from '../../ps2-streaming-client/types';
import { PS2StreamingClient } from '../../ps2-streaming-client';
import { Leaderboard } from './types';
import { countBy, forEach, groupBy, max, sortBy, uniq, values } from 'lodash';
import { FacilityVM, OutfitMemberVM, ZoneVM } from '../../ps2-rest-client/types';
import { PS2StreamingEvent } from '../../ps2-streaming-client/consts';
import PQueue from 'p-queue';

enum Status {
  'NotReady',
  'Opened',
  'Started',
  'Stopped',
  'Closed',
};

export class OpTracker {
  private _readyPromise: Promise<this>;
  private _eventProcessingQueue: PQueue;
  private _discordGuild: DiscordGuild;
  private _message: Message | null = null;
  private _channel: TextChannel | null = null;
  private _debriefChannel: TextChannel | null = null;
  private _voiceChannels: Array<VoiceChannel> = [];
  private _soloReports: Array<{ user: User, characterId: string }> = [];
  private _opEvents: Array<GainExperienceDto | DeathDto> = [];
  private _baseCaptures: Array<FacilityVM> = [];
  private _ps2StreamingClientCharacters: PS2StreamingClient | null = null;
  // time variables
  private _startTime: DateTime | null = null;
  private _startTrackingTime: DateTime | null = null;
  private _stopTrackingTime: DateTime | null = null;
  private _stopTime: DateTime | null = null;
  // reports variables
  private _overviewMessage: Message | null = null;
  private _killLeaderboard: Leaderboard | null = null;
  private _reviveLeaderboard: Leaderboard | null = null;
  private _healLeaderboard: Leaderboard | null = null;
  private _transportLeaderboard: Leaderboard | null = null;

  get ready(): Promise<this> {
    if (this._ps2StreamingClientCharacters !== null) return new Promise(resolve => resolve(this));
    return this._readyPromise;
  }

  get started(): boolean {
    return !!this._startTime;
  }

  get stopped(): boolean {
    return !!this._startTime && !!this._stopTime;
  }

  get startedTracking(): boolean {
    return !!this._startTrackingTime;
  }

  get stoppedTracking(): boolean {
    return !!this._stopTrackingTime;
  }

  get status(): string {
    return Object.values(Status)[this.statusKey] as string;
  }

  private get statusKey(): number {
    if (this._ps2StreamingClientCharacters === null) return Status.NotReady;
    if (this.started && !this.startedTracking) return Status.Opened;
    if (this.startedTracking && !this.stoppedTracking) return Status.Started;
    if (this.stoppedTracking && !this.stopped) return Status.Stopped;
    return Status.Closed;
  }

  constructor(discordClient: DiscordClient, discordGuild: DiscordGuild) {
    this._readyPromise = Promise.all([
      PS2StreamingClient.getInstance().then(client => {
        this._ps2StreamingClientCharacters = client;
        return this;
      }),
      discordClient.channels.fetch(DiscordChannelIdOps).then(channel => {
        if (channel.type !== 'text') throw('Ops channel should be a text channel.');
        this._channel = channel as TextChannel;
        return this._channel;
      }),
      discordClient.channels.fetch(DiscordChannelIdOpsDebrief).then(channel => {
        if (channel.type !== 'text') throw('Ops debrief channel should be a text channel.');
        this._debriefChannel = channel as TextChannel;
        return this._debriefChannel;
      }),
    ]).then(() => this);
    this._eventProcessingQueue = new PQueue({ concurrency: 1 });
    this._discordGuild = discordGuild;
  }

  async start() {
    if (this.started) throw('Op has already started.');
    
    if (this._ps2StreamingClientCharacters === null) {
      await this.ready.then(async () => await this.start());
      return;
    }

    if (!this._channel) throw('Unexpected op _channel null');

    this._startTime = DateTime.local();

    this._voiceChannels.push(await this._createChannel('Alpha', 12));
    this._voiceChannels.push(await this._createChannel('Bravo', 12));
    this._voiceChannels.push(await this._createChannel('Charlie', 12));
    this._voiceChannels.push(await this._createChannel('Delta', 12));

    this._message = await this._channel.send(
      `Opened an op. Send "op start" command to start tracking in-game events.`
    + `\nSend a private message to ${getDiscordMention(discordBotUser.id)} saying "op _planetside2username_" to receive an individual op report when we stop the op.`
    );
  }

  async startTracking() {
    if (!this.started) await this.ready.then(() => this.start());

    if (!this._channel) throw('Unexpected op _channel null');
    if (this.startedTracking) throw('Op has already started tracking.');

    this._startTrackingTime = DateTime.local();
    await this._startListeners();
    setInterval(this._resetListeners, 1000 * 60 * 30);

    const messageText = `Started tracking an op. Send "op stop" command to stop tracking in-game events.`
    + `\nSend "op close" command to stop the op, close voice channels and close applications for indiviual op reports.`
    + `\nSend a private message to <@!${discordBotUser.id}> saying "op _planetside2username_" to receive an individual op report when we stop the op.`;

    if (this._message) await this._message.edit(messageText);
    else await this._channel.send(messageText);
  }

  async stopTracking() {
    if (!this.started) throw('Op has not started yet.');
    if (!this.startedTracking) throw('Op has not started tracking yet.');

    if (!this._channel) throw ('Unexpected op _channel null.');

    await this._stopListeners();
    this._stopTrackingTime = DateTime.local();

    await this._eventProcessingQueue.onEmpty().then(() => this._eventProcessingQueue.pause());

    await this._sendOverviewReport();
    await this.startDebrief();

    this._soloReports.forEach(async soloReport => {
      this._sendSoloOpReport(soloReport);
    });
  }

  async startDebrief() {
    if (!this.stoppedTracking) throw('Op has not stopped tracking yet.');

    if (!this._debriefChannel) throw('Unexpected op _debriefChannel null.');
    if (!this._overviewMessage) throw('Unexpected op _overviewMessage null.');

    const date = new Date();
    const dayName = Intl.DateTimeFormat('en-GB', {weekday: 'long'}).format(date);
    const dateString = Intl.DateTimeFormat('en-GB').format(date);

    const descriptionText = `Start your debrief comments with your squad and SL's name.`
    + `\nPlease keep it to one message per person.`;

    const exampleText = `[Alpha] SL: KIZZZZ`
    + `\nKIZZZZ best SL no one even close.`;

    const embed = new MessageEmbed()
      .setTitle(`Debrief: ${dayName} ${dateString} op`)
      .setURL(this._overviewMessage.url)
      .setDescription(descriptionText)
      .addField(`Example`, exampleText);

    await this._debriefChannel.send(embed);
  }

  async stop() {
    if (!this.started) throw('Op has not started yet.');
    if (this.stopped) throw('Op has already stopped.');

    if (!this._channel) throw('Unexpected op _channel null.');

    if (this.startedTracking && !this.stoppedTracking) {
      await this.stopTracking();
    }

    this._stopTime = DateTime.local();

    if (this._message?.deletable) await this._message.delete({ reason: 'The op has ended.' });
    await this._removeChannels(DiscordChannelIdOpsLobby);
  }

  async addSoloOpReport(user: User, characterId: string) {
    const soloReport = { user, characterId };
    this._soloReports.push(soloReport);

    if (this.stoppedTracking) {
      await this._sendSoloOpReport(soloReport);
    }
  }

  async addBaseCapture(facility: FacilityVM) {
    if (this.startedTracking && !this.stoppedTracking) {
      this._baseCaptures.push(facility);
    }
  }

  // private methods
  private _createChannel = async (squadName: string, userLimit: number) => {
    return await this._discordGuild.channels.create(`Op ${squadName}`, { type: 'voice', userLimit: userLimit, parent: DiscordCategoryIdOps });
  }

  private _removeChannels = async (moveChannelId: string) => {
    this._voiceChannels.forEach(async voiceChannel => {
      if (!voiceChannel.deletable) throw(`Can't delete op voice channel.`);

      voiceChannel.members.forEach(async member => {
        await member.voice.setChannel(moveChannelId, 'The op has ended.');
      });

      wait(15000).then(async () => { await voiceChannel.delete('The op has ended.'); });
    });
  }

  private _sendOverviewReport = async () => {
    if (!this.stoppedTracking) throw('Op has not stopped tracking yet.');

    if (!this._channel) throw('Unexpected op _channel null.');
    if (!this._startTrackingTime) throw('Unexpected op _startTrackingTime null.');
    if (!this._stopTrackingTime) throw('Unexpected op _endTrackingTime null.');

    const duration = Interval.fromDateTimes(this._startTrackingTime, this._stopTrackingTime).toDuration();

    const participants = uniq(this._opEvents.map(event => {
        if (event.event_name === 'GainExperience') return (event as GainExperienceDto).character_id;
        if (event.event_name === 'Death') return (event as DeathDto).attacker_character_id;
      }))
      .map(id => ps2MainOutfit.members.find(member => member.id === id))
      .filter(member => !!member) as Array<OutfitMemberVM>;

    const participantNames = participants.length
      ? participants.map(participant => participant.name).join(', ')
      : 'No one earned XP.';

    const continentXPCounts = countBy(this._opEvents, xp => xp.zone_id);
    const continentXPTreshold = Math.floor((max(values(continentXPCounts)) ?? 0) / 16);
    const continents: Array<ZoneVM> = [];
    forEach(continentXPCounts, (continentXPCount, key) => {
      if (continentXPCount > continentXPTreshold) {
        const zone = ps2Zones.find(zone => zone.id === key);
        if (!zone) return console.log(`zone with id ${key} not found.`);

        continents.push(zone);
      }
    });
    const continentNames = continents.length
      ? continents.map(continent => continent.name).join(', ')
      : 'None';

    ///

    this._killLeaderboard = this._getKillLeaderboard();
    this._reviveLeaderboard = this._getXPLeaderboard(['7', '53']);
    this._healLeaderboard = this._getXPLeaderboard(['4', '51']);
    this._transportLeaderboard = this._getXPLeaderboard(['30']);

    ///

    const baseCaptures = this._baseCaptures.length
    ? `${this._baseCaptures.map((facility) => `${facility.name} (${facility.zone.name} ${facility.type})`).join('\n')}`
    : 'None';

    ///

    const reportEmbed = new MessageEmbed()
      .setTitle(`[${ps2MainOutfit.alias}] ${ps2MainOutfit.name} op report.`)
      .addField(`${participants.length} Participants:`, participantNames, false)
      .addField('Base captures', baseCaptures, false)
      .addField('Duration', `${duration.toFormat('hh:mm:ss')}`, true)
      .addField('Continents', continentNames, true)
      .addField('\u200b', '\u200b', false)
      .addField('Kills', this._killLeaderboard.score, true)
      .addField('Revives', this._reviveLeaderboard.score, true)
      .addField('Heals', this._healLeaderboard.score, true)
      .addField('Transport assists', this._transportLeaderboard.score, true);

    if (
      this._killLeaderboard.score
      || this._reviveLeaderboard.score
      || this._healLeaderboard.score
      || this._transportLeaderboard.score
    ) {
      reportEmbed.addField('\u200b', '\u200b', false);
    }

    ///

    if (this._killLeaderboard.score) this._addLeaderboardField(reportEmbed, this._killLeaderboard, 'Kills', 3);
    if (this._reviveLeaderboard.score) this._addLeaderboardField(reportEmbed, this._reviveLeaderboard, 'Revives', 3);
    if (this._healLeaderboard.score) this._addLeaderboardField(reportEmbed, this._healLeaderboard, 'Heals', 3);
    if (this._transportLeaderboard.score) this._addLeaderboardField(reportEmbed, this._transportLeaderboard, 'Transport assists', 3);

    /// OVERVIEW REPORT
    this._overviewMessage = await this._channel.send(reportEmbed);

    return reportEmbed;
  }

  private _sendSoloOpReport = async (soloReport: { user: User, characterId: string }) => {
    if (!this.stoppedTracking) throw('Op has not stopped tracking yet.');

    if (!this._killLeaderboard) throw('Unexpected op _killLeaderboard null');
    if (!this._reviveLeaderboard) throw('Unexpected op _reviveLeaderboard null');
    if (!this._healLeaderboard) throw('Unexpected op _healLeaderboard null');
    if (!this._transportLeaderboard) throw('Unexpected op _transportLeaderboard null');
    if (!this._overviewMessage) throw('Unexpected op _overviewMessage null');

    const member = ps2MainOutfit.members.find(member => member.id === soloReport.characterId);
    if (!member) throw('Solo op report member not found');

    const killEntry = this._killLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const reviveEntry = this._reviveLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const healEntry = this._healLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const transportEntry = this._transportLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);

    const soloEmbed = new MessageEmbed()
      .setTitle(`${member.name} op report.`)
      .setURL(this._overviewMessage.url)
      .addField('Kills', killEntry?.score ?? 0, true)
      .addField('Kills rank', killEntry?.rank ?? 'n/a', true)
      .addField('\u200b', '\u200b', false)
      .addField('Revives', reviveEntry?.score ?? 0, true)
      .addField('Revives rank', reviveEntry?.rank ?? 'n/a', true)
      .addField('\u200b', '\u200b', false)
      .addField('Heals', healEntry?.score ?? 0, true)
      .addField('Heals rank', healEntry?.rank ?? 'n/a', true)
      .addField('\u200b', '\u200b', false)
      .addField('Transport assists', transportEntry?.score ?? 0, true)
      .addField('Transport assists rank', transportEntry?.rank ?? 'n/a', true);

    await soloReport.user.send(soloEmbed);
  }

  private _getKillLeaderboard = ():Leaderboard => {
    const leaderboard: Leaderboard = { score: 0, entries: [] };

    const filteredEvents = this._opEvents.filter(event => event.event_name === 'Death') as DeathDto[];
    leaderboard.score = filteredEvents.length;
    if (!leaderboard.score) return leaderboard;

    const sortedMemberEvents = sortBy(groupBy(filteredEvents, event => event.attacker_character_id), memberEvents => (memberEvents.length * -1));
    let rank = 0;
    sortedMemberEvents.forEach(memberKills => {
      const score = memberKills.length;
      const member = ps2MainOutfit.members.find(member => member.id === memberKills[0].attacker_character_id);
      if (!leaderboard.entries.filter(entry => entry.score === score).length) rank++;
      if (!member) throw('unexpected leaderboard member not found.');

      leaderboard.entries.push({ score, member, rank });
    });

    return leaderboard;
  }

  private _getXPLeaderboard = (xpTypes: Array<string>):Leaderboard => {
    const leaderboard: Leaderboard = { score: 0, entries: [] };

    const filteredXP = this._opEvents.filter(event => event.event_name === 'GainExperience' && xpTypes.includes((event as GainExperienceDto).experience_id)) as GainExperienceDto[];
    leaderboard.score = filteredXP.length;
    if (!leaderboard.score) return leaderboard;

    const sortedMemberXPs = sortBy(groupBy(filteredXP, xp => xp.character_id), memberXP => (memberXP.length * -1));
    let rank = 0;
    sortedMemberXPs.forEach(memberGainXPs => {
      const score = memberGainXPs.length
      const member = ps2MainOutfit.members.find(member => member.id === memberGainXPs[0].character_id);
      if (!leaderboard.entries.filter(entry => entry.score === score).length) rank++;
      if (!member) throw('unexpected leaderboard member not found.');

      leaderboard.entries.push({ score, member, rank });
    });

    return leaderboard;
  }

  private _addLeaderboardField = async (embed: MessageEmbed, leaderboard: Leaderboard, eventName: string, noRanks: number): Promise<MessageEmbed> => {
    let leaderboardText = ``;
    for (let i=0; i<noRanks; i++) {
      const rankEntries = leaderboard.entries.filter(entry => entry.rank === i+1);
      if (!rankEntries.length) break;

      if (i !== 0) leaderboardText += `\n`;
      leaderboardText += `${rankEntries.map(entry => entry.member.name).join(', ')} with ${rankEntries[0].score} ${eventName.toLowerCase()}`;
    }
    return embed.addField(`${eventName} MVP`, leaderboardText, false)
  }

  private _resetListeners = async () => {
    if (!this.started) return;

    await this._stopListeners();
    await wait(800);
    await this._startListeners();
  }

  private _startListeners = async () => {
    if (this._ps2StreamingClientCharacters === null) return;
    
    this._eventProcessingQueue.start();

    // subscribe deaths
    this._ps2StreamingClientCharacters.subscribe(
      PS2StreamingEvent.Death,
      async data => {
        this._eventProcessingQueue.add(async () => {
          const deathDTO = data as DeathDto;

          const character = ps2MainOutfit.members.find(member => member.id === deathDTO.attacker_character_id);
          if (!character) return; // character not found in outfit.

          const isDuplicate = this._opEvents.filter(event => event.timestamp === deathDTO.timestamp).includes(deathDTO);
          if (isDuplicate) return; // filter duplicates, because ps2 census API does weird things sometimes.

          const killedFaction = await ps2RestClient.getPlayerFaction({characterId: deathDTO.character_id});
          if (killedFaction.id === ps2MainOutfit.faction.id) return; // teamkills don't count.

          this._opEvents.push(deathDTO);
        });
      },
      {
        characters: ps2MainOutfit.members.map(member => member.id),
      }
    );

    // subscribe experience
    this._ps2StreamingClientCharacters.subscribe(
      PS2StreamingEvent.GainExperience,
      async data => {
        this._eventProcessingQueue.add(async () => {
          const xpDTO = data as GainExperienceDto;

          const character = ps2MainOutfit.members.find(member => member.id === xpDTO.character_id);
          if (!character) return; // character not found in outfit.

          const isDuplicate = this._opEvents.filter(event => event.timestamp === xpDTO.timestamp).includes(xpDTO);
          if (isDuplicate) return; // filter duplicates, because ps2 census API does weird things sometimes.

          this._opEvents.push(xpDTO);
        });
      },
      {
        characters: ps2MainOutfit.members.map(member => member.id),
        experienceIds: [
          '4', /* Heal */
          '51', /* Squad heal */

          '7', /* Revive */
          '53', /* Squad revive */

          '30', /* Transport Assist */
        ],
      }
    );
  }

  private _stopListeners = async () => {
    if (this._ps2StreamingClientCharacters === null) return;

    this._ps2StreamingClientCharacters.unsubscribe(PS2StreamingEvent.GainExperience, { characters: ['all'] });
    this._ps2StreamingClientCharacters.unsubscribe(PS2StreamingEvent.Death, { characters: ['all'] });
  }
}
