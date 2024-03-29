import { Command } from '../types';
import { consoleCatch } from '../../../utils';
import { ps2RestClient } from '../../../app';
import { HexColorString, EmbedBuilder, ChannelType } from 'discord.js';

export async function MembersCommandHandler (command: Command): Promise<void> {
  if (!command.discordMessage) throw('Unexpected MembersCommandHandler command.discordMessage null');
  if (command.discordMessage.channel.type !== ChannelType.GuildText && command.discordMessage.channel.type !== ChannelType.DM) throw('unexpected non-text command channel.');

  const aliasLookup = command.param || 'BJay';

  command.discordMessage.channel.sendTyping();

  const outfit = await ps2RestClient.getOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
  if (!outfit) {
    await command.discordMessage.channel.send(`[${aliasLookup}] not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`[${outfit.alias}] ${outfit.name}`)
    .setURL(`https://ps2.fisu.pw/outfit/?name=${outfit.alias}`)
    .addFields([
      { name: 'Total members', value: `${outfit.memberCount}`, inline: true },
      { name: 'Leader', value: `${outfit.leader}`, inline: true },
    ]);

  if (outfit.faction.color) {
    embed.setColor(`#${outfit.faction.color}` as HexColorString);
  }

  await command.discordMessage.channel.send({embeds: [embed]});
}
