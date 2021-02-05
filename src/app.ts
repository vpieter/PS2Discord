import { PS2RestClient } from './ps2-rest-client';
import { ZoneVM, MainOutfitVM, FactionVM, CapturedFacilityVM } from './ps2-rest-client/types';
import { Client as DiscordClient, ClientUser as DiscordClientUser, Guild } from 'discord.js';
import { trackMainOutfitMembersOnline, trackMainOutfitBaseCaptures, setDiscordCommandListeners, setPS2DiscordGreetingListener, trackDiscordUsers } from './functions';
import { DiscordBotToken, DiscordGuildId, KoaPort } from './consts';
import { consoleCatch } from './utils';
import { Op, TrackedDiscordUser, Training } from './types';
import MyKoa from './my-koa';
import { filter, map, sortBy } from 'lodash';

// Global
export let koa: MyKoa;

export let ps2RestClient: PS2RestClient;
export let ps2Factions: Array<FactionVM> = [];
export let ps2Zones: Array<ZoneVM> = [];
export let ps2MainOutfit: MainOutfitVM;
export let ps2ControlledBases: Array<CapturedFacilityVM> = [];

export let discordClient = new DiscordClient();
export let discordBotUser: DiscordClientUser;
export let discordGuild: Guild;

export let runningActivities: {[key: string]: Op | Training} = {};
export let trackedDiscordUsers: {[key: string]: TrackedDiscordUser} = {};

async function init() {
  // Koa
  koa = new MyKoa(KoaPort);

  // koa.indexRouter.get('index', '/', async function (ctx) {
  //   ctx.body = await ctx.render('index', { tests: ['test1', 'test2', 'test3'] } );
  // })

  koa.expose('activity', async () => {
    const trackedMembers = filter(trackedDiscordUsers, user => user.member);
    const activeMembers = filter(trackedMembers, member => member.voiceHistory.length > 0);
    const sortedMembers = sortBy(activeMembers, member => Math.abs(member.voiceHistory[0].date.diffNow('milliseconds').milliseconds));

    return map(sortedMembers, member => ({
      username: member.username,
      displayName: member.displayName,
      lastChannel: member.voiceHistory[0].channelName,
      lastSeen: member.voiceHistory[0].date.toFormat('dd MMM yyyy HH:mm'),
    }));
  });

  koa.debugExpose('ps2Factions', async () => ps2Factions);
  koa.debugExpose('ps2Zones', async () => ps2Zones);
  koa.debugExpose('ps2MainOutfit', async () => ps2MainOutfit);
  koa.debugExpose('ps2ControlledBases', async () => ps2ControlledBases);
  koa.debugExpose('runningActivities', async () => runningActivities);
  koa.debugExpose('trackedDiscordUsers', async () => trackedDiscordUsers);

  // Discord
  discordClient.once('ready', discordReady);
  discordClient.on('error', consoleCatch);
  discordClient.on('rateLimit', consoleCatch);

  await discordClient.login(DiscordBotToken);
};

async function discordReady() {
  if (!discordClient.user || !discordClient.user.bot) throw('Discord bot user not found.');
  discordBotUser = discordClient.user;

  const guild = discordClient.guilds.resolve(DiscordGuildId);
  if (!guild) throw('Guild not found.');
  discordGuild = guild;

  // Functions
  const PS2Init = async function() {
    // PS2RestClient
    ps2RestClient = PS2RestClient.getInstance();
    ps2Factions = await ps2RestClient.getFactions();
    ps2Zones = await ps2RestClient.getZones();
    ps2MainOutfit = await ps2RestClient.getMainOutfit();

    // PS2Functions
    await setPS2DiscordGreetingListener();

    await trackMainOutfitBaseCaptures();
    await trackMainOutfitMembersOnline();
    await trackDiscordUsers();

    await setDiscordCommandListeners();

    console.log(`PS2Discord running for ${ps2MainOutfit.alias}.`);
  };

  await PS2Init().catch(() => {
    console.log('exception during PS2Init. retrying in 3 minutes.');
    setTimeout(PS2Init, 3 * 60 * 1000);
  });

  // Not a good idea but I'm trying it anyway.
  process.on('uncaughtException', function (err) {
    console.log(err);
  });
};

// Init
init();
