import { Command } from '../types';
import { MessageEmbed } from 'discord.js';
import { filter, map } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { activityTracker, ps2MainOutfit } from '../../../app';
import { getDiscordMention } from '../../../utils';

export async function ActivityCommandHandler (command: Command): Promise<void> {
  const trackedMembers = filter(activityTracker.activityStore.value(), user => user.member);
  const activeMembers = filter(trackedMembers, member => member.voiceHistory.length > 0);

  const activity = map(activeMembers, member => {
    const duration = Interval.fromDateTimes(member.voiceHistory[0].date , DateTime.local()).toDuration();
    return `${getDiscordMention(member.id)} last seen ${duration.toFormat('d')} days ago in "${member.voiceHistory[0].channelName}"`;
  });

  const activityString = activity.length
    ? activity.join('\n')
    : 'No active members';

  const activityEmbed = new MessageEmbed()
    .setTitle(`${ps2MainOutfit.alias} member activity`)
    .addField(`${activity.length} Active members:`, activityString, false);

  await command.message.channel.send(activityEmbed);
  return Promise.resolve();
};
