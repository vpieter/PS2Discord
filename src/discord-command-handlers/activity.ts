import { MessageEmbed } from 'discord.js';
import { filter, map } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { ps2MainOutfit, trackedDiscordUsers } from '../app';
import { Command } from '../types';

export async function ActivityCommandHandler (command: Command): Promise<void> {
  const trackedMembers = filter(trackedDiscordUsers, user => user.member);
  const activeMembers = filter(trackedMembers, member => member.voiceHistory.length > 0);

  const activity = map(activeMembers, member => {
    const duration = Interval.fromDateTimes(member.voiceHistory[0].date , DateTime.local()).toDuration();
    return `<@${member.id}> last seen ${duration.toFormat('d')} days ago in "${member.voiceHistory[0].channelName}"`;
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
