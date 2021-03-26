import { Command } from '../types';
import { discordGuild, runningActivities, discordClient, ps2MainOutfit } from '../../../app';
import { Activities, DiscordChannelIdOps, DiscordRoleIdLeader, DiscordRoleIdMember, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../../../consts';
import { TextChannel } from 'discord.js';
import { OpTracker } from '../..';

enum SubCommand {
  'Open' = 'open',
  'Start' = 'start',
  'Stop' = 'stop',
  'Close' = 'close'
};

export async function OpCommandHandler (command: Command): Promise<void> {
  const channel = await discordClient.channels.fetch(DiscordChannelIdOps) as TextChannel;
  if (channel.type !== 'text') throw('Ops channel should be a text channel.');

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
  let runningOp = runningActivities[Activities.Op] as OpTracker;

  switch(command.param) {
    case SubCommand.Open: {
      if (command.message.channel.type === 'text') await command.message.delete();

      if (runningOp) {
        await command.message.channel.send('An op is already running. Send "op close" command to make room for a new op.');
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

      if (command.message.channel.type === 'text') await command.message.delete();

      // Start
      await runningOp.startTracking();

      break;
    }
    case SubCommand.Stop: {
      if (!runningOp) {
        await command.message.channel.send(`An op is not yet running. Send "op ${SubCommand.Start}" command to start.`);
      } else {
        if (command.message.channel.type === 'text') await command.message.delete();

        // Stop
        await runningOp.stopTracking();
      }

      break;
    }
    case SubCommand.Close: {
      if (!runningOp) {
        await command.message.channel.send(`An op is not yet running. Send "op ${SubCommand.Start}" command to start.`);
      } else {
        if (command.message.channel.type === 'text') await command.message.delete();

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
        await command.message.channel.send(
          `It's currently not possible to apply for an individual op report.`
        + `\nYou can apply during and for a short while after we end the op.`
        );
      } else {
        // ps2 username needs to be given
        if (command.param) {
          const member = ps2MainOutfit.members.find(member => member.name.toLowerCase() === command.param.toLowerCase());

          // only members have been tracked and can apply
          if (member) {
            if (!runningOp.stoppedTracking) {
              await command.message.channel.send(`You'll receive a solo op report for '${command.param}' when the current op ends.`);
            }
            await runningOp.addSoloOpReport(command.message.author, member.id);
          } else {
            await command.message.channel.send(`Cannot find member '${command.param}'.`);
          }
        }
      }

      break;
    }
  }  
};
