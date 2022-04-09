import { Constants as DiscordConstants, HexColorString, Interaction, MessageEmbed } from 'discord.js';
import { discordGuild, ps2MainOutfit, ps2RestClient } from '../../../app';
import { consoleCatch } from '../../../utils';

export class MembersCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'members')) return;

    await discordGuild.commands.create({
      name: 'members',
      description: 'Displays planetside outfit members.',
      options: [{
        name: 'outfit-tag',
        description: 'The outfit tag to look up.',
        required: false,
        type: DiscordConstants.ApplicationCommandOptionTypes.STRING,
      }, {
        name: 'public',
        description: 'Posts the response publicly in the current channel if true',
        required: false,
        type: DiscordConstants.ApplicationCommandOptionTypes.BOOLEAN,
      }]
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isCommand() || interaction.commandName !== 'members') return;

    const aliasLookup = interaction.options.getString('outfit-tag') || ps2MainOutfit.alias || 'BJay';
    const isPublic = interaction.options.getBoolean('public');

    await interaction.deferReply({ephemeral: !isPublic});

    const outfit = await ps2RestClient.getOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
    if (!outfit) {
      await interaction.editReply({content: `[${aliasLookup}] not found.`});
      return;
    }

    const embed = new MessageEmbed()
      .setTitle(`[${outfit.alias}] ${outfit.name}`)
      .setURL(`https://ps2.fisu.pw/outfit/?name=${outfit.alias}`)
      .addField('Total members', `${outfit.memberCount}`, true)
      .addField('Leader', `${outfit.leader}`, true);

    if (outfit.faction.color) {
      embed.setColor(`#${outfit.faction.color}` as HexColorString);
    }

    await interaction.editReply({embeds: [embed]});
  }
}
