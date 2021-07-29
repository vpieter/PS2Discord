import { CommandInteraction, Constants as DiscordConstants, Interaction } from "discord.js";
import { OpTracker } from "../..";
import { discordClient, discordGuild, runningActivities } from "../../../app";
import { Activities, DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from "../../../consts";

export class OpCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'op')) return;

    const cmd = await discordGuild.commands.create({
      name: 'op',
      description: `Manage ops.`,
      defaultPermission: false,
      options: [{
        name: 'open',
        description: 'Open an op.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }, {
        name: 'start',
        description: 'Start an op.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }, {
        name: 'stop',
        description: 'Stop an op.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }, {
        name: 'close',
        description: 'Close an op.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }],
    });
    
    await cmd.permissions.add({
      permissions: ([DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist] as `${bigint}`[]).map(discordId => ({
        type: DiscordConstants.ApplicationCommandPermissionTypes.ROLE,
        id: discordId,
        permission: true,
      }))
    });

    await cmd.permissions.add({
      permissions: (['101347311627534336'] as `${bigint}`[]).map(discordId => ({
        type: DiscordConstants.ApplicationCommandPermissionTypes.USER,
        id: discordId,
        permission: true,
      }))
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isCommand() || interaction.commandName !== 'op') return;

    await interaction.defer({ephemeral: true});

    const action = interaction.options.getSubcommand();
    switch (action) {
      case 'open': {
        await this.open(interaction);
        break;
      }
      case 'start': {
        await this.start(interaction);
        break;
      }
      case 'stop': {
        await this.stop(interaction);
        break;
      }
      case 'close': {
        await this.close(interaction);
        break;
      }
    }
  }

  private static async open(interaction: CommandInteraction) {
    // guard
    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (runningOp) {
      await interaction.editReply({content: 'An op is already open.'});
      return;
    }

    // open
    const op = new OpTracker(discordClient, discordGuild);
    await op.start();
    runningActivities[Activities.Op] = op;
    await interaction.editReply({content:'Opened an op.'});
  }

  private static async start(interaction: CommandInteraction) {
    // guard
    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (!runningOp) {
      await interaction.editReply({content: 'An op is not yet open.'});
      return;
    }

    if (runningOp.startedTracking) {
      await interaction.editReply({content: 'An op is already started.'});
      return;
    }

    // start
    await runningOp.startTracking();
    await interaction.editReply({content:'Started tracking an op.'});
  }

  private static async stop(interaction: CommandInteraction) {
    // guard
    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (!runningOp) {
      await interaction.editReply({content: 'An op is not yet open.'});
      return;
    }

    if (!runningOp.startedTracking) {
      await interaction.editReply({content: 'An op is not yet started.'});
      return;
    }

    if (runningOp.stoppedTracking) {
      await interaction.editReply({content: 'An op is already stopped.'});
      return;
    }

    // stop
    await runningOp.stopTracking();
    await interaction.editReply({content: 'Op stopped.'});
  }

  private static async close(interaction: CommandInteraction) {
    // guard
    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (!runningOp) {
      await interaction.editReply({content: 'An op is not yet open.'});
      return;
    }

    if (!runningOp.startedTracking) {
      await interaction.editReply({content: 'An op is not yet started.'});
      return;
    }

    if (!runningOp.stoppedTracking) {
      await interaction.editReply({content: 'An op is not yet stopped.'});
      return;
    }

    if (runningOp.stopped) {
      await interaction.editReply({content: 'An op is already closed.'});
      return;
    }

    // stop
    await runningOp.stop();
    delete runningActivities[Activities.Op];
    await interaction.editReply({content: 'Op closed.'});
  }
}
