import { discordGuild, ps2MainOutfit, ps2RestClient, ps2Zones } from '../app';
import { PS2StreamingEvent } from '../ps2-streaming-client/consts';
import { GainExperienceDto, DeathDto } from '../ps2-streaming-client/types';
import { PS2StreamingClient } from '../ps2-streaming-client';
import { uniq, groupBy, sortBy, countBy, forEach, max, values } from 'lodash';
import { MessageEmbed, Message, VoiceChannel, User } from 'discord.js';
import { OutfitMemberVM, ZoneVM } from '../ps2-rest-client/types';
import { DateTime, Interval } from 'luxon';
import { Op, Status } from '../types';
import { DiscordCategoryIdOps, DiscordChannelIdOpsLobby } from '../consts';
import { consoleCatch, wait } from '../utils';
import PQueue from 'p-queue';

const experienceNamesHardcoded = {
  // '1': 'kill',
  // '278': 'Priority kill',
  // '279': 'High priority kill',
  '4': 'Heal',
  '51': 'Squad heal',
  '7': 'Revive',
  '53': 'Squad revive',
  '30': 'Transport Assist',
} as any;

type Leaderboard = {
  score: number,
  entries: Array<LeaderboardEntry>
};

type LeaderboardEntry = {
  score: number,
  rank: number,
  member: OutfitMemberVM,
};

export async function trackMainOutfitOp(runningMessage: Message, characterId?: string): Promise<Op> {
  const queue = new PQueue({concurrency: 1});
  const ps2StreamingClientCharacters = await PS2StreamingClient.getInstance();

  const startTime = DateTime.local();
  const opEvents: Array<GainExperienceDto | DeathDto> = [];
  const opVoiceChannels: Array<VoiceChannel> = [];

  const channel = runningMessage.channel;

  // reports variables
  let overviewMessage: Message;
  let killLeaderboard: Leaderboard;
  let reviveLeaderboard: Leaderboard;
  let healLeaderboard: Leaderboard;
  let transportLeaderboard: Leaderboard;

  // internal functions
  const start = async function(): Promise<void> {
    opVoiceChannels.push(await discordGuild.channels.create('Ops Alpha', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    opVoiceChannels.push(await discordGuild.channels.create('Ops Bravo', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    opVoiceChannels.push(await discordGuild.channels.create('Ops Charlie', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    opVoiceChannels.push(await discordGuild.channels.create('Ops Delta', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));

    ps2StreamingClientCharacters.subscribe(
      PS2StreamingEvent.Death,
      async data => {
        queue.add(async () => {
          const deathDTO = data as DeathDto;

          const character = ps2MainOutfit.members.find(member => member.id === deathDTO.attacker_character_id);
          if (!character) return; // character not found in outfit.

          if (opEvents.filter(event => event.timestamp === deathDTO.timestamp).includes(deathDTO)) return;

          const killedFaction = await ps2RestClient.getPlayerFaction({characterId: deathDTO.character_id});
          if (killedFaction.id === ps2MainOutfit.faction.id) return; // teamkills don't count.
          opEvents.push(deathDTO);
        })
      }
    )
    ps2StreamingClientCharacters.subscribe(
      PS2StreamingEvent.GainExperience,
      async data => {
        queue.add(async () => {
          const xpDTO = data as GainExperienceDto;

          const character = ps2MainOutfit.members.find(member => member.id === xpDTO.character_id);
          if (!character) return; // character not found in outfit.

          if (opEvents.filter(event => event.timestamp === xpDTO.timestamp).includes(xpDTO)) return;
          opEvents.push(xpDTO);

          if (channel.type === 'dm') {
            const zone = ps2Zones.find(zone => zone.id === xpDTO.zone_id);
            if (!zone) throw('op xp zone id not found');
  
            const embed = new MessageEmbed()
              .setTitle(`${character.name} vs ${xpDTO.other_id}`)
              .addField('Continent', `${zone.name}`, true)
              .addField('XP type', `${experienceNamesHardcoded[xpDTO.experience_id]}`, true)
              .addField('Timestamp', `${xpDTO.timestamp}`, true);
  
            await channel.send(embed);
          }
        });
      },
      {
        characters: characterId ? [characterId] : ps2MainOutfit.members.map(member => member.id),
        experienceIds: [
          // '1', /* kill */
          // '278', /* Priority kill */
          // '279', /* High priority kill */

          '4', /* Heal */
          '51', /* Squad heal */

          '7', /* Revive */
          '53', /* Squad revive */

          '30', /* Transport Assist */
        ],
      }
    );
  };

  const stop = async function(op: Op): Promise<void> {
    if (op.status >= Status.Stopped) {
      await channel.send('The op has already been stopped.');
      return;
    }

    ps2StreamingClientCharacters.unsubscribe(
      PS2StreamingEvent.GainExperience
    );
    ps2StreamingClientCharacters.unsubscribe(
      PS2StreamingEvent.Death
    );

    queue.onEmpty().then(async () => {
      queue.pause();

      const endTime = DateTime.local();
      const duration = Interval.fromDateTimes(startTime, endTime).toDuration();

      ///

      const participants = uniq(opEvents.map(event => {
          if (event.event_name === 'GainExperience') return (event as GainExperienceDto).character_id;
          if (event.event_name === 'Death') return (event as DeathDto).attacker_character_id;
        }))
        .map(id => ps2MainOutfit.members.find(member => member.id === id))
        .filter(member => !!member) as Array<OutfitMemberVM>;
      const participantNames = participants.length
        ? participants.map(participant => participant.name).join(', ')
        : 'No one earned XP.';

      const continentXPCounts = countBy(opEvents, xp => xp.zone_id);
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

      killLeaderboard = await getKillLeaderboard();
      reviveLeaderboard = await getXPLeaderboard(['7', '53']);
      healLeaderboard = await getXPLeaderboard(['4', '51']);
      transportLeaderboard = await getXPLeaderboard(['30']);

      ///

      const baseCaptures = runningOp.baseCaptures.length
      ? `${runningOp.baseCaptures.map((facility) => `${facility.name} (${facility.zone.name} ${facility.type})`).join('\n')}`
      : 'None';

      ///

      const overviewEmbed = new MessageEmbed()
        .setTitle(`[${ps2MainOutfit.alias}] ${ps2MainOutfit.name} op report.`)
        .addField(`${participants.length} Participants:`, participantNames, false)
        .addField('Base captures', baseCaptures, false)
        .addField('Duration', `${duration.toFormat('hh:mm:ss')}`, true)
        .addField('Continents', continentNames, true)
        .addField('\u200b', '\u200b', false)
        .addField('Kills', killLeaderboard.score, true)
        .addField('Revives', reviveLeaderboard.score, true)
        .addField('Heals', healLeaderboard.score, true)
        .addField('Transport assists', transportLeaderboard.score, true);
      
      if (killLeaderboard.score
        || reviveLeaderboard.score
        || healLeaderboard.score
        || transportLeaderboard.score
      ) {
        overviewEmbed.addField('\u200b', '\u200b', false);
      }

      ///

      if (killLeaderboard.score) await addLeaderboardField(overviewEmbed, killLeaderboard, 'Kills', 3);
      if (reviveLeaderboard.score) await addLeaderboardField(overviewEmbed, reviveLeaderboard, 'Revives', 3);
      if (healLeaderboard.score) await addLeaderboardField(overviewEmbed, healLeaderboard, 'Heals', 3);
      if (transportLeaderboard.score) await addLeaderboardField(overviewEmbed, transportLeaderboard, 'Transport assists', 3);

      /// OVERVIEW REPORT
      overviewMessage = await channel.send(overviewEmbed);

      /// SOLO REPORTS
      op.soloReports.forEach(async soloReport => { await sendSoloOpReport(soloReport); });
    });

    op.status = Status.Stopped;
  };

  const close = async (op: Op): Promise<void> => {
    if (op.status >= Status.Closed) {
      channel.send('The op has already been closed.');
      return;
    }

    op.voiceChannels.forEach(async voiceChannel => {
      voiceChannel.members.forEach(async member => {
        await member.voice.setChannel(DiscordChannelIdOpsLobby).catch(consoleCatch);
      });

      wait(15000).then(async () => {
        await voiceChannel.delete('The op has ended.').catch(consoleCatch);
      });
    });

    await runningMessage.delete();

    op.status = Status.Closed;
  };

  const sendSoloOpReport = async (soloReport: { user: User, characterId: string }): Promise<void> => {
    const member = ps2MainOutfit.members.find(member => member.id === soloReport.characterId);
    if (!member) throw('Solo op report member not found');
    
    const killEntry = killLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const reviveEntry = reviveLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const healEntry = healLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);
    const transportEntry = transportLeaderboard.entries.find(leaderboardEntry => leaderboardEntry.member.id === soloReport.characterId);

    const soloEmbed = new MessageEmbed()
      .setTitle(`${member.name} op report.`)
      .setURL(overviewMessage.url)
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
  };

  const getKillLeaderboard = async function():Promise<Leaderboard> {
    const leaderboard: Leaderboard = { score: 0, entries: [] };

    const filteredEvents = opEvents.filter(event => event.event_name === 'Death') as DeathDto[];
    leaderboard.score = filteredEvents.length;
    if (!leaderboard.score) return leaderboard;

    const sortedMemberEvents = sortBy(groupBy(filteredEvents, event => event.attacker_character_id), memberEvents => (memberEvents.length * -1));
    let rank = 0;
    sortedMemberEvents.forEach(memberKills => {
      const score = memberKills.length
      const member = ps2MainOutfit.members.find(member => member.id === memberKills[0].attacker_character_id);
      if (!leaderboard.entries.filter(entry => entry.score === score).length) rank++;
      if (!member) throw('unexpected leaderboard member not found.');

      leaderboard.entries.push({ score, member, rank });
    });

    return leaderboard;
  };

  const getXPLeaderboard = async function(xpTypes: Array<string>):Promise<Leaderboard> {
    const leaderboard: Leaderboard = { score: 0, entries: [] };

    const filteredXP = opEvents.filter(event => event.event_name === 'GainExperience' && xpTypes.includes((event as GainExperienceDto).experience_id)) as GainExperienceDto[];
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
  };

  const addLeaderboardField = async function(embed: MessageEmbed, leaderboard: Leaderboard, eventName: string, noRanks: number): Promise<MessageEmbed> {
    let leaderboardText = ``;
    for (let i=0; i<noRanks; i++) {
      const rankEntries = leaderboard.entries.filter(entry => entry.rank === i+1);
      if (!rankEntries.length) break;

      if (i !== 0) leaderboardText += `\n`;
      leaderboardText += `${rankEntries.map(entry => entry.member.name).join(', ')} with ${rankEntries[0].score} ${eventName.toLowerCase()}`;
    }
    return embed.addField(`${eventName} MVP`, leaderboardText, false)
  }

  // trackMainOutfitOp
  const runningOp: Op = {
    status: Status.Running,
    events: opEvents,
    baseCaptures: [],
    voiceChannels: opVoiceChannels,
    soloReports: [],
    stop: stop,
    close: close,
    sendSoloReport: sendSoloOpReport,
  };

  await start();
  return runningOp;
};
