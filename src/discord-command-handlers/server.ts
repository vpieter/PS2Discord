import { ps2ControlledBases, ps2MainOutfit, discordClient, discordGuild } from '../app';
import { Command } from '../types';
import { DiscordGuildId } from '../consts';
import { MessageEmbed } from 'discord.js';

export async function ServerCommandHandler (command: Command): Promise<void> {
  let embed = new MessageEmbed()
    .setTitle(discordGuild.name)
    .addField('id', discordGuild.id, true)
    .addField('owner', discordGuild.owner?.toString());

  const guildIconUrl = discordGuild.iconURL({format: 'png', dynamic: false, size: 128});
  if (guildIconUrl) embed = embed.setImage(guildIconUrl);

  await command.message.channel.send(embed);
  return Promise.resolve();
};
