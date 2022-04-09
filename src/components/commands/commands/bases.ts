import { Constants as DiscordConstants, HexColorString, Interaction, MessageEmbed } from 'discord.js';
import { discordGuild, ps2ControlledBases, ps2MainOutfit } from '../../../app';

export class BasesCommand {
  static async register() {
    const cmds = await discordGuild.commands.fetch();
    if (cmds.find(cmd => cmd.name === 'bases')) return;

    await discordGuild.commands.create({
      name: 'bases',
      description: `Displays planetside bases currently controlled by ${ps2MainOutfit.alias}.`,
      options: [{
        name: 'public',
        description: 'Posts the response publicly in the current channel if true',
        required: false,
        type: DiscordConstants.ApplicationCommandOptionTypes.BOOLEAN,
      }],
    });
  }

  static async handle(interaction: Interaction) {
    if (!interaction.isCommand() || interaction.commandName !== 'bases') return;

    const outfit = ps2MainOutfit;
    const basesText = ps2ControlledBases.length ?
      ps2ControlledBases.map(facility => `${facility.name} (${facility.zone.name} ${facility.type})`).join(`\n`) :
      'No bases';

    const embed = new MessageEmbed()
      .setTitle(`[${outfit.alias}] ${outfit.name}`)
      .setURL(`https://ps2.fisu.pw/outfit/?name=${outfit.alias}`)
      .addField('Currently controls', basesText, false);

    if (outfit.faction.color) {
      embed.setColor(`#${outfit.faction.color}` as HexColorString);
    }

    const isPublic = interaction.options.getBoolean('public');
    await interaction.reply({embeds: [embed], ephemeral: !isPublic});
  }
}
