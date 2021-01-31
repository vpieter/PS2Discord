import { discordClient, ps2MainOutfit } from '../app';
import { DiscordGuildId, DiscordChannelIdWelcome, DiscordChannelIdRules } from '../consts';
import { consoleCatch } from '../utils';

export async function setPS2DiscordGreetingListener(): Promise<void> {
  discordClient.on('guildMemberAdd', async guildMember => {
    if (guildMember.guild.id !== DiscordGuildId) {
      console.log(`unexpected guild id in discordGreetingListener (${guildMember.guild.id})`);
      return;
    }

    await guildMember.send(`Welcome to the ${ps2MainOutfit?.alias ?? 'outfit'} Discord,`
    + `\nPlease start by reading our <#${DiscordChannelIdRules}>. We'll keep it short!`
    + `\n`
    + `\nIf you are applying to join the outfit, please contact a leader or officer.`
    + `\nIf you are part of another outfit, please add the [tag] to your discord nickname.`
    + `\n`
    + `\nFeel free to introduce yourself in <#${DiscordChannelIdWelcome}>.`).catch(consoleCatch);

    await guildMember.send(`To learn more about this bot type "help".`).catch(consoleCatch);
  });
  return Promise.resolve();
};
