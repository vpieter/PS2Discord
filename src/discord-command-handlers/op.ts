import { Command, Op, Status } from '../types';
import { trackMainOutfitOp } from '../functions';
import { discordGuild, runningActivities, discordClient, ps2MainOutfit, discordBotUser } from '../app';
import { Activities, DiscordChannelIdOps, DiscordRoleIdLeader, DiscordRoleIdMember, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../consts';
import { TextChannel } from 'discord.js';
import { values } from 'lodash';

enum SubCommand {
  'Start' = 'start',
  'Stop' = 'stop',
  'Close' = 'close'
};

export async function OpCommandHandler (command: Command): Promise<void> {
  const channel = await discordClient.channels.fetch(DiscordChannelIdOps);
  if (channel.type !== 'text') throw('Ops channel should be a text channel.');

  // Default param
  if (command.param === null) {
    command.param = SubCommand.Start;
  }

  // Permission
  const leaderRole = await discordGuild.roles.fetch(DiscordRoleIdLeader);
  const officerRole = await discordGuild.roles.fetch(DiscordRoleIdOfficer);
  const specialistRole = await discordGuild.roles.fetch(DiscordRoleIdSpecialist);
  const memberRole = await discordGuild.roles.fetch(DiscordRoleIdMember);
  if (command.param in SubCommand) {
    if (command.message.author.id !== '101347311627534336' && // potterv override
      !leaderRole?.members.find(member => member.id === command.message.author.id) &&
      !officerRole?.members.find(member => member.id === command.message.author.id) &&
      !specialistRole?.members.find(member => member.id === command.message.author.id)
    ) {
      await command.message.channel.send('You can\'t use this command (staff only).');
      return;
    }
  } else {
    if (!memberRole?.members.find(member => member.id === command.message.author.id)) {
      await command.message.channel.send('You can\'t use this command (members only).');
      return;
    }
  }

  // OpCommandHandler
  const runningOp = runningActivities[Activities.Op] as Op;

  if (command.param === SubCommand.Stop) {
    if (!runningOp) {
      await command.message.channel.send(`An op is not yet running. Send "op ${SubCommand.Start}" command to start.`);
      return;
    }

    if (command.message.channel.type === 'text') await command.message.delete();
    await runningOp.stop(runningOp);
    return;
  }

  if (command.param === SubCommand.Close) {
    if (!runningOp) {
      await command.message.channel.send(`An op is not yet running. Send "op ${SubCommand.Start}" command to start.`);
      return;
    }

    if (command.message.channel.type === 'text') await command.message.delete();

    if (runningOp.status <= Status.Running) await runningOp.stop(runningOp);

    await runningOp.close(runningOp);

    delete runningActivities[Activities.Op];
    return;
  }

  if (runningOp) {
    if (command.param) {
      const member = ps2MainOutfit.members.find(member => member.name.toLowerCase() === command.param.toLowerCase());
      if (!member) {
        await command.message.channel.send(`Cannot find member '${command.param}'.`);
        return;
      }
  
      const soloReportUser = { user: command.message.author, characterId: member.id };
      if (runningOp.status <= Status.Running) {
        (runningOp as Op).soloReports.push(soloReportUser);
        await command.message.channel.send(`You'll receive a solo op report for '${command.param}' when the current op ends.`);
      } else {
        await runningOp.sendSoloReport(soloReportUser)
      }
      return;
    }

    await command.message.channel.send(`An op is already running. Send "op ${SubCommand.Close}" command to close the previous op before starting a new one.`);
    return;
  }

  if (command.param !== SubCommand.Start) {
    await command.message.channel.send(
      `It's currently not possible to apply for an individual op report.`
    + `\nYou can apply during and for a short while after we end the op.`
    );
    return;
  }

  //////////////

  const runningMessage = await (channel as TextChannel).send(
    `Started tracking an op. Send "op stop" command to stop tracking in-game events.`
  + `\nSend "op close" command to stop the op, close voice channels and close applications for indiviual op reports.`
  + `\nSend a private message to <@!${discordBotUser.id}> saying "op _planetside2username_" to receive an individual op report when we stop the op.`
  );
  runningActivities[Activities.Op] = await trackMainOutfitOp(runningMessage);
  if (command.message.channel.type === 'text') await command.message.delete();
};
