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
      command.discordAuthorId !== '101347311627534336' && // potterv override
      !leaderRole?.members.find(member => member.id === command.discordAuthorId) &&
      !officerRole?.members.find(member => member.id === command.discordAuthorId) &&
      !specialistRole?.members.find(member => member.id === command.discordAuthorId)
  ) {
    if (command.discordMessage) await command.discordMessage.channel.send('You can\'t use this command (staff only).');
    return;
  }

  // TrainingCommandHandler
  const runningTraining = runningActivities[Activities.Training] as TrainingTracker;
  if (command.param === 'stop') {
    if (command.discordMessage?.channel?.type === 'GUILD_TEXT') await command.discordMessage.delete();

    if (!runningTraining) {
      if (command.discordMessage) await command.discordMessage.channel.send('A training is not yet running. Use "/training start" command to start.');
      return;
    }

    await runningTraining.stop();
    delete runningActivities[Activities.Training];
    return;
  }

  if (runningTraining) {
    if (command.discordMessage?.channel?.type === 'GUILD_TEXT') await command.discordMessage.delete();
    if (command.discordMessage) await command.discordMessage.channel.send('A training is already running. Use "/training stop" command to stop.');
    return;
  }

  //////////////

  const training = new TrainingTracker(discordClient, discordGuild);
  training.start();

  runningActivities[Activities.Training] = training;
  if (command.discordMessage?.channel?.type === 'GUILD_TEXT') await command.discordMessage.delete();
}
