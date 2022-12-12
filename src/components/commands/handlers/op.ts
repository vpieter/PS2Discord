import { Command } from '../types';
import { discordGuild, runningActivities, discordClient, ps2MainOutfit } from '../../../app';
import { Activities, DiscordChannelIdOps, DiscordRoleIdLeader, DiscordRoleIdMember, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../../../consts';
import { OpTracker } from '../..';
import { ChannelType } from 'discord.js';

enum SubCommand {
  'Open' = 'open',
  'Start' = 'start',
  'Stop' = 'stop',
  'Close' = 'close',
}

export async function OpCommandHandler (command: Command): Promise<void> {
  const channel = await discordClient.channels.fetch(DiscordChannelIdOps);
  if (!channel) throw(`Unexpected null channel (${DiscordChannelIdOps}).`);
  if (channel.type !== ChannelType.GuildText) throw('Ops channel should be a text channel.');

  // Param alias
  if (command.param === 'init') {
    command.param = SubCommand.Open;
  }

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
    if (command.discordAuthorId !== '101347311627534336' && // potterv override
      !leaderRole?.members.find(member => member.id === command.discordAuthorId) &&
      !officerRole?.members.find(member => member.id === command.discordAuthorId) &&
      !specialistRole?.members.find(member => member.id === command.discordAuthorId)
    ) {
      if (command.discordMessage) await command.discordMessage.channel.send('You can\'t use this command (staff only).');
      return;
    }
  } else {
    if (!memberRole?.members.find(member => member.id === command.discordAuthorId)) {
      if (command.discordMessage) await command.discordMessage.channel.send('You can\'t use this command (members only).');
      return;
    }
  }

  // OpCommandHandler
  let runningOp = runningActivities[Activities.Op] as OpTracker;

  switch(command.param) {
    case SubCommand.Open: {
      if (command.discordMessage?.channel?.type === ChannelType.GuildText) await command.discordMessage.delete();

      if (runningOp) {
        if (command.discordMessage) await command.discordMessage.channel.send('An op is already running. Use "/op close" command to make room for a new op.');
        return;
      }

      // Open
      runningOp = runningActivities[Activities.Op] = new OpTracker(discordClient, discordGuild);
      await runningOp.start();

      break;
    }
    case SubCommand.Start: {
      if (!runningOp) {
        // implicit open
        runningOp = runningActivities[Activities.Op] = new OpTracker(discordClient, discordGuild);
        await runningOp.start();
      }

      if (command.discordMessage?.channel?.type === ChannelType.GuildText) await command.discordMessage.delete();

      // Start
      await runningOp.startTracking();

      break;
    }
    case SubCommand.Stop: {
      if (!runningOp) {
        if (command.discordMessage) await command.discordMessage.channel.send(`An op is not yet running. Use "/op ${SubCommand.Start}" command to start.`);
      } else {
        if (command.discordMessage?.channel?.type === ChannelType.GuildText) await command.discordMessage.delete();

        // Stop
        await runningOp.stopTracking();
      }

      break;
    }
    case SubCommand.Close: {
      if (!runningOp) {
        if (command.discordMessage) await command.discordMessage.channel.send(`An op is not yet running. Use "/op ${SubCommand.Start}" command to start.`);
      } else {
        if (command.discordMessage?.channel?.type === ChannelType.GuildText) await command.discordMessage.delete();

        // Close
        await runningOp.stop();

        // Delete from running
        delete runningActivities[Activities.Op];
      }

      break;
    }
    default: {
      // solo report signup
      if (!runningOp) {
        if (command.discordMessage) {
          await command.discordMessage.channel.send(
            `It's currently not possible to apply for an individual op report.`
          + `\nYou can apply during and for a short while after we end the op.`
          );
        }
      } else {
        // ps2 username needs to be given
        if (command.param) {
          const member = ps2MainOutfit.members.find(member => member.name.toLowerCase() === command.param.toLowerCase());

          // only members have been tracked and can apply
          if (member) {
            if (!runningOp.stoppedTracking) {
              if (command.discordMessage) {
                await command.discordMessage.channel.send(`You'll receive a solo op report for '${command.param}' when the current op ends.`);
              }
            }
            if (command.discordMessage) await runningOp.addSoloOpReport(command.discordMessage.author, member.id);
          } else {
            if (command.discordMessage) await command.discordMessage.channel.send(`Cannot find member '${command.param}'.`);
          }
        }
      }

      break;
    }
  }
}
