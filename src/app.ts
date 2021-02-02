import { PS2RestClient } from './ps2-rest-client';
import { ZoneVM, MainOutfitVM, FactionVM, CapturedFacilityVM } from './ps2-rest-client/types';
import { Client as DiscordClient, ClientUser as DiscordClientUser, Guild } from 'discord.js';
import { trackMainOutfitMembersOnline, trackMainOutfitBaseCaptures, setDiscordCommandListeners, setPS2DiscordGreetingListener } from './functions';
import { DiscordBotToken, DiscordGuildId } from './consts';
import { consoleCatch } from './utils';
import { Op, Training } from './types';
import Koa from 'koa';
import MyKoaRouter from './my-koa-router';
import koaCompress from 'koa-compress';

// Global
export let ps2RestClient: PS2RestClient;
export let ps2Factions: Array<FactionVM>;
export let ps2Zones: Array<ZoneVM>;
export let ps2MainOutfit: MainOutfitVM;
export let ps2ControlledBases: Array<CapturedFacilityVM> = [];

export let discordClient = new DiscordClient();
export let discordBotUser: DiscordClientUser;
export let discordGuild: Guild;

export let runningActivities: Record<string, Op | Training> = {};

export const koa = new Koa();
export const koaRouter = new MyKoaRouter();
export const koaDebugRouter = new MyKoaRouter({ prefix: '/debug' });

async function init() {
  // discord
  discordClient.once('ready', discordReady);
  discordClient.on('error', consoleCatch);
  discordClient.on('rateLimit', consoleCatch);

  discordClient.login(DiscordBotToken);

  // koa
  koaRouter.get('index', '/', async (ctx) => { ctx.body = 'Hello world!'; });
  koa.use(koaRouter.routes()).use(koaRouter.allowedMethods());

  koaDebugRouter.get('ps2Factions', '/ps2Factions', async (ctx) => { ctx.body = ps2Factions; });
  koaDebugRouter.get('ps2Zones', '/ps2Zones', async (ctx) => { ctx.body = ps2Zones; });
  koaDebugRouter.get('ps2MainOutfit', '/ps2MainOutfit', async (ctx) => { ctx.body = ps2MainOutfit; });
  koaDebugRouter.get('ps2ControlledBases', '/ps2ControlledBases', async (ctx) => { ctx.body = ps2ControlledBases; });
  koaDebugRouter.get('runningActivities', '/runningActivities', async (ctx) => { ctx.body = runningActivities; });
  koa.use(koaDebugRouter.routes()).use(koaDebugRouter.allowedMethods());

  koa.use(koaCompress());
  koa.listen(3000);
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
