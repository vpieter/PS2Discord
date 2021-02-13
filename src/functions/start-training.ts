import { GuildMember, Message, MessageEmbed, VoiceChannel, VoiceState } from 'discord.js';
import { DateTime, Interval } from 'luxon';
import { discordClient, discordGuild, ps2MainOutfit } from '../app';
import { DiscordCategoryIdOps, DiscordChannelIdOpsLobby } from '../consts';
import { Training } from '../types';
import { wait } from '../utils';

export async function startTraining(runningMessage: Message): Promise<Training> {
  const startTime = DateTime.local();
  const trainingVoiceChannels: Array<VoiceChannel> = [];
  const opParticipantIds: Array<string> = [];

  const channel = runningMessage.channel;

  // internal functions
  const voiceStatusUpdateListener = (oldState: VoiceState, newState: VoiceState) => {
    if (newState.channelID === null || newState.member === null) return;
    if (!trainingVoiceChannels.some(channel => channel.id === newState.channelID)) return;
    if (opParticipantIds.some(participantId => participantId === newState.member?.id)) return;
    
    opParticipantIds.push(newState.member.id);
  };

  const start = async function(): Promise<void> {
    discordClient.on('voiceStateUpdate', voiceStatusUpdateListener);

    trainingVoiceChannels.push(await discordGuild.channels.create('Training Alpha', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    trainingVoiceChannels.push(await discordGuild.channels.create('Training Bravo', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    trainingVoiceChannels.push(await discordGuild.channels.create('Training Charlie', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
    trainingVoiceChannels.push(await discordGuild.channels.create('Training Delta', { type: 'voice', userLimit: 12, parent: DiscordCategoryIdOps }));
  };

  const stop = async function(training: Training): Promise<void> {
    await runningMessage.delete();

    discordClient.off('voiceStateUpdate', voiceStatusUpdateListener);

    const endTime = DateTime.local();
    const participantNames = opParticipantIds.length
        ? opParticipantIds.map(participantId => `<@${participantId}>`).join(', ')
        : 'No one joined the training voice channels.';
    const duration = Interval.fromDateTimes(startTime, endTime).toDuration();
    const overviewEmbed = new MessageEmbed()
      .setTitle(`[${ps2MainOutfit.alias}] ${ps2MainOutfit.name} training report.`)
      .addField(`${opParticipantIds.length} Participants:`, participantNames, false)
      .addField('Duration', `${duration.toFormat('hh:mm:ss')}`, true);
    await channel.send(overviewEmbed);

    training.voiceChannels.forEach(async voiceChannel => {
      voiceChannel.members.forEach(async member => {
        await member.voice.setChannel(DiscordChannelIdOpsLobby);
      });

      wait(15000).then(async () => {
        await voiceChannel.delete('The training has ended.')
      });
    });
  };

  // startTraining
  const runningTraining: Training = {
    voiceChannels: trainingVoiceChannels,
    participantIds: opParticipantIds,
    stop: stop,
  };

  await start();
  return runningTraining;
};
