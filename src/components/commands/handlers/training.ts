import { Command } from '../types';
import { discordClient, discordGuild, runningActivities } from '../../../app';
import { Activities, DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../../../consts';
import { TrainingTracker } from '../..';

export async function TrainingCommandHandler (command: Command): Promise<void> {
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
  const runningTraining = runningActivities[Activities.Training] as TrainingTracker;
  if (command.param === 'stop') {
    if (command.message.channel.type === 'text') await command.message.delete();

    if (!runningTraining) {
      await command.message.channel.send('A training is not yet running. Send "training" command to start.');
      return;
    }

    await runningTraining.stop();
    delete runningActivities[Activities.Training];
    return;
  }

  if (runningTraining) {
    if (command.message.channel.type === 'text') await command.message.delete();
    await command.message.channel.send('A training is already running. Send "training stop" command to stop.');
    return;
  }

  //////////////

  const training = new TrainingTracker(discordClient, discordGuild);
  training.start();

  runningActivities[Activities.Training] = training;
  if (command.message.channel.type === 'text') await command.message.delete();
};
