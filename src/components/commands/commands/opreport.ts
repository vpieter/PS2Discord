import { ApplicationCommandOptionType, ApplicationCommandPermissionType, Interaction } from "discord.js";
import { OpTracker } from "../..";
import { discordGuild, ps2MainOutfit, runningActivities } from "../../../app";
import { Activities, DiscordBotToken, DiscordRoleIdMember } from "../../../consts";

export class OpReportCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'opreport')) return;

    const cmd = await discordGuild.commands.create({
      name: 'opreport',
      description: 'Display personal op reports.',
      defaultMemberPermissions: '0',
      dmPermission: false,
      options: [{
        name: 'character-name',
        description: 'The PlanetSide character name to look up.',
        required: true,
        type: ApplicationCommandOptionType.String,
      }, {
        name: 'public',
        description: 'Posts the response publicly in the current channel if true',
        required: false,
        type: ApplicationCommandOptionType.Boolean,
      }],
    });

    await cmd.permissions.add({
      permissions: ([DiscordRoleIdMember] as `${bigint}`[]).map(discordId => ({
        type: ApplicationCommandPermissionType.Role,
        id: discordId,
        permission: true,
      })),
      token: DiscordBotToken,
    });

    await cmd.permissions.add({
      permissions: (['101347311627534336'] as `${bigint}`[]).map(discordId => ({
        type: ApplicationCommandPermissionType.User,
        id: discordId,
        permission: true,
      })),
      token: DiscordBotToken,
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'opreport') return;

    // guard
    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (!runningOp) {
      await interaction.reply({content: 'An op is not yet running.', ephemeral: true})
      return;
    }

    if (!runningOp.stoppedTracking) {
      await interaction.reply({content: 'The op has not yet stopped.', ephemeral: true})
      return;
    }

    // opreport
    const characterLookup = interaction.options.getString('character-name', true);
    const isPublic = interaction.options.getBoolean('public');

    const characterId = ps2MainOutfit.members.find(member => member.name.toLowerCase() === characterLookup.toLowerCase())?.id;
    if (!characterId) {
      await interaction.reply({content: `Cannot find member '${characterLookup}'.`, ephemeral: true});
      return;
    }

    const soloReport = runningOp.generateSoloOpReport(characterId);
    if (!soloReport) {
      await interaction.reply({content: `Failed to generate report for ${characterLookup}.`, ephemeral: true});
      return;
    }

    await interaction.reply({embeds: [soloReport], ephemeral: !isPublic});
  }
}
