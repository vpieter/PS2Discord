declare module "*/ps2discord.json" {
  const file: {
    discordBot: {
      token: string,
      appClient: string,
      appSecret: string,
    },
    discordGuild: {
      guildId: string,
      channelIdRules: string,
      channelIdWelcome: string,
      channelIdOutfit: string,
      channelIdFacility: string,
      categoryIdOps: string,
      channelIdOpsLobby: string,
      channelIdOps: string,
      channelIdOpsDebrief: string,
      channelIdMentoring: string,
      roleIdLeader: string,
      roleIdOfficer: string,
      roleIdSpecialist: string,
      roleIdMember: string,
      categoryIdSignups: string,
    },
    ps2: {
      apiToken: string,
      outfitId: `${number}`,
    },
    koa: {
      host: `http${string}`,
      port: number,
      cookieKeys: string[],
    },
  };
  export default file;
}
