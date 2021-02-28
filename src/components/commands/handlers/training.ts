import { Command } from '../types';
import { Training } from '../../../types';
import { startTraining } from '../../../functions';
import { discordClient, discordGuild, runningActivities } from '../../../app';
import { Activities, DiscordChannelIdMentoring as DiscordChannelIdTraining, DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../../../consts';
import { TextChannel } from 'discord.js';

export async function TrainingCommandHandler (command: Command): Promise<void> {
  const channel = await discordClient.channels.fetch(DiscordChannelIdTraining);
  if (channel.type !== 'text') throw('Training channel should be a text channel.');

  // Staff permission
  const leaderRole = await discordGuild.roles.fetch(DiscordRoleIdLeader);
  const officerRole = await discordGuild.roles.fetch(DiscordRoleIdOfficer);
  const specialistRole = await discordGuild.roles.fetch(DiscordRoleIdSpecialist);
  if (
      command.message.author.id !== '101347311627534336' && // potterv override
      !leaderRole?.members.find(member => member.id === command.message.author.id) &&
      !officerRole?.members.find(member => member.id === command.message.author.id) &&
      !specialistRole?.members.find(member => member.id === command.message.author.id)
  ) {
    await command.message.channel.send('You can\'t use this command (staff only).');
    return;
  }

  // TrainingCommandHandler
  const runningTraining = runningActivities[Activities.Training] as Training;
  if (command.param === 'stop') {
    if (!runningTraining) {
      await command.message.channel.send('A training is not yet running. Send "training" command to start.');
      return;
    }

    if (command.message.channel.type === 'text') await command.message.delete();
    await runningTraining.stop(runningTraining);
    delete runningActivities[Activities.Training];
    return;
  }

  if (runningTraining) {
    await command.message.channel.send('A training is already running. Send "training stop" command to stop.');
    return;
  }

  //////////////

  const runningMessage = await (channel as TextChannel).send('Started a training. Send "training stop" command to stop.');
  runningActivities[Activities.Training] = await startTraining(runningMessage);
  if (command.message.channel.type === 'text') await command.message.delete();
};
