import { ApplicationCommandOptionType, EmbedBuilder, HexColorString, Interaction } from 'discord.js';
import { discordGuild, ps2MainOutfit, ps2RestClient } from '../../../app';
import { consoleCatch } from '../../../utils';

export class OnlineCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'online')) return;

    await discordGuild.commands.create({
      name: 'online',
      description: 'Displays online planetside outfit members.',
      options: [{
        name: 'outfit-tag',
        description: 'The outfit tag to look up.',
        required: false,
        type: ApplicationCommandOptionType.String,
      }, {
        name: 'public',
        description: 'Posts the response publicly in the current channel if true.',
        required: false,
        type: ApplicationCommandOptionType.Boolean,
      }],
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'online') return;

    const aliasLookup = interaction.options.getString('outfit-tag') || ps2MainOutfit.alias || 'BJay';
    const isPublic = interaction.options.getBoolean('public');

    await interaction.deferReply({ephemeral: !isPublic});

    const onlineOutfit = await ps2RestClient.getOnlineOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
    if (!onlineOutfit) {
      await interaction.editReply(`[${aliasLookup}] not found.`);
      return;
    }

    const onlineMembersString = onlineOutfit.onlineMembers
      .sort((a, b) => a.localeCompare(b, undefined, {ignorePunctuation: true}))
      .join(', ');

    const embed = new EmbedBuilder()
      .setTitle(`[${onlineOutfit.alias}] ${onlineOutfit.name}`)
      .setURL(`https://ps2.fisu.pw/outfit/?name=${onlineOutfit.alias}`)
      .addFields([
        { name: 'Online members', value: `${onlineOutfit.onlineMembers.length}`, inline: true },
        { name: 'Total members', value: `${onlineOutfit.memberCount}`, inline: true },
        { name: 'Leader', value: `${onlineOutfit.leader}`, inline: true },
      ]);

    if (onlineOutfit.onlineMembers.length) {
      embed.setDescription(`${onlineMembersString}`);
    }
    if (onlineOutfit.faction.color) {
      embed.setColor(`#${onlineOutfit.faction.color}` as HexColorString);
    }

    await interaction.editReply({embeds: [embed]});
  }
}
