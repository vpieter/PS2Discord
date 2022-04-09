import { CommandInteraction, Constants as DiscordConstants, Interaction } from 'discord.js';
import { TrainingTracker } from '../..';
import { discordClient, discordGuild, runningActivities } from '../../../app';
import { Activities, DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist } from '../../../consts';

export class TrainingCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'training')) return;

    const cmd = await discordGuild.commands.create({
      name: 'training',
      description: `Manage trainings.`,
      defaultPermission: false,
      options: [{
        name: 'start',
        description: 'Start a training.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }, {
        name: 'stop',
        description: 'Stop a training.',
        type: DiscordConstants.ApplicationCommandOptionTypes.SUB_COMMAND,
      }],
    });

    await cmd.permissions.add({
      permissions: ([DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist] as `${bigint}`[]).map(discordId => ({
        type: DiscordConstants.ApplicationCommandPermissionTypes.ROLE,
        id: discordId,
        permission: true,
      })),
    });

    await cmd.permissions.add({
      permissions: (['101347311627534336'] as `${bigint}`[]).map(discordId => ({
        type: DiscordConstants.ApplicationCommandPermissionTypes.USER,
        id: discordId,
        permission: true,
      })),
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isCommand() || interaction.commandName !== 'training') return;

    await interaction.deferReply({ephemeral: true});

    const action = interaction.options.getSubcommand();
    switch (action) {
      case 'start': {
        await this.start(interaction);
        break;
      }
      case 'stop': {
        await this.stop(interaction);
        break;
      }
    }
  }

  private static async start(interaction: CommandInteraction) {
    // guard
    const runningTraining = runningActivities[Activities.Training] as TrainingTracker;
    if (runningTraining) {
      await interaction.editReply({content: 'A training is already running.'});
      return;
    }

    // start
    const training = new TrainingTracker(discordClient, discordGuild);
    await training.start();
    runningActivities[Activities.Training] = training;

    await interaction.editReply({content:'Started a training.'});
  }

  private static async stop(interaction: CommandInteraction) {
    // guard
    const runningTraining = runningActivities[Activities.Training] as TrainingTracker;
    if (!runningTraining) {
      await interaction.editReply({content: 'A training is not yet running.'});
      return;
    }

    // stop
    await runningTraining.stop();
    delete runningActivities[Activities.Training];
    await interaction.editReply({content: 'Training stopped.'});
  }
}
