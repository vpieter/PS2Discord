import { PS2RestClient } from './ps2-rest-client';
import { ZoneVM, MainOutfitVM, FactionVM, CapturedFacilityVM } from './ps2-rest-client/types';
import { Client as DiscordClient, ClientUser as DiscordClientUser, Guild as DiscordGuild } from 'discord.js';
import { ActivityTracker, BaseCapturesTracker, DiscordCommandListener, DiscordGreeter, MainOutfitUpdater, MembersOnlineTracker, OpTracker, TrainingTracker } from './components';
import { Command } from './components/commands';
import { Commands } from './components/commands/commands';
import { Activities, DiscordBotToken, DiscordGuildId, KoaPort } from './consts';
import { consoleCatch, wait } from './utils';
import { filter, map, sortBy } from 'lodash';
import MyKoa, { getGrantDiscordProfile } from './my-koa';

// Global
export const ps2RestClient = PS2RestClient.getInstance();
export let ps2Factions: Array<FactionVM> = [];
export let ps2Zones: Array<ZoneVM> = [];
export let ps2MainOutfit: MainOutfitVM;
export let ps2ControlledBases: Array<CapturedFacilityVM> = [];

export let discordClient = new DiscordClient();
export let discordBotUser: DiscordClientUser;
export let discordGuild: DiscordGuild;
export let koa: MyKoa;
export const mainOutfitUpdater = new MainOutfitUpdater();
export const activityTracker = new ActivityTracker(discordClient);
export const discordCommandListener = new DiscordCommandListener(discordClient);
export const discordGreeter = new DiscordGreeter(discordClient);
export const membersOnlineTracker = new MembersOnlineTracker(discordClient);
export const baseCapturesTracker = new BaseCapturesTracker(discordClient);

export let runningActivities: {[key: string]: OpTracker | TrainingTracker} = {};

const init = async () => {
  // Discord
  discordClient.once('ready', discordReady);
  discordClient.on('error', consoleCatch);
  discordClient.on('rateLimit', consoleCatch);

  await discordClient.login(DiscordBotToken);
};

const discordReady = async () => {
  if (!discordClient.user || !discordClient.user.bot) throw('Discord bot user not found.');
  discordBotUser = discordClient.user;

  const guild = discordClient.guilds.resolve(DiscordGuildId);
  if (!guild) throw('Guild not found.');
  if (!guild.available) throw('Guild not available.');
  discordGuild = guild;

  // Koa
  koa = new MyKoa(KoaPort, discordGuild);
  koa.indexRouter.get('/', async (ctx) => {
    ctx.body = await ctx.render('index', {
      title: 'index',
      runningActivities,
      Activities,
      user: ctx.state.user,
    });
  });
  koa.indexRouter.use('/save', koa.devMiddleware).post('/save', async (ctx) => {
    await activityTracker.activityStore.save();
    ctx.redirect(ctx.origin);
  });
  koa.indexRouter.use('/op/:opParam', koa.devMiddleware).post('/op/:opParam', async (ctx) => {
    const paramExists = ['open', 'start', 'stop', 'close'].some(opParam => opParam === ctx.params.opParam);
    if (!paramExists) return;

    const command: Command = {
      commandName: Commands.Op,
      param: ctx.params.opParam,
      discordAuthorId: getGrantDiscordProfile(ctx).id,
    };
    discordCommandListener.handle(command);
    await wait(1000); // TODO: awaittable commands

    ctx.redirect(ctx.origin);
  });
  koa.indexRouter.use('/training/:trainingParam', koa.devMiddleware).post('/training/:trainingParam', async (ctx) => {
    const paramExists = ['start', 'stop'].some(trainingParam => trainingParam === ctx.params.trainingParam);
    if (!paramExists) return;

    const command: Command = {
      commandName: Commands.Training,
      param: ctx.params.trainingParam,
      discordAuthorId: getGrantDiscordProfile(ctx).id,
    };
    discordCommandListener.handle(command);
    await wait(1000); // TODO: awaittable commands

    ctx.redirect(ctx.origin);
  });

  koa.expose('activity', async () => {
    const trackedMembers = filter(activityTracker.activityStore.value(), user => user.member);
    const activeMembers = filter(trackedMembers, member => member.voiceHistory.length > 0);
    const sortedMembers = sortBy(activeMembers, member => Math.abs(member.voiceHistory[0].date.diffNow('milliseconds').milliseconds));

    return map(sortedMembers, member => ({
      username: member.username,
      displayName: member.displayName,
      lastChannel: member.voiceHistory[0].channelName,
      lastSeen: member.voiceHistory[0].date.toFormat('dd MMM yyyy HH:mm ZZZZ'),
    }));
  });

  koa.debugExpose('ps2Factions', async () => ps2Factions);
  koa.debugExpose('ps2Zones', async () => ps2Zones);
  koa.debugExpose('ps2MainOutfit', async () => ps2MainOutfit);
  koa.debugExpose('ps2ControlledBases', async () => ps2ControlledBases);
  koa.debugExpose('runningActivities', async () => runningActivities);
  koa.debugExpose('trackedDiscordUsers', async () => activityTracker.activityStore.value());
  
  koa.publicExpose('profile', async (ctx) => ctx.session?.grant?.response?.profile ?? {});

  koa.init();

  // Components
  const PS2Init = async () => {
    // PS2RestClient
    ps2Factions = await ps2RestClient.getFactions();
    [ps2Zones, ps2MainOutfit] = await Promise.all([
      ps2RestClient.getZones(),
      ps2RestClient.getMainOutfit(),
    ]);

    // Start PS2Discord components
    mainOutfitUpdater.start();
    activityTracker.start();
    discordCommandListener.start();
    discordGreeter.start();
    await Promise.all([
      membersOnlineTracker.start(),
      baseCapturesTracker.start(),
    ]);

    console.log(`PS2Discord running for ${ps2MainOutfit.alias}.`);
  };

  await PS2Init().catch(() => {
    console.log('exception during PS2Init. retrying in 3 minutes.');
    setTimeout(PS2Init, 3 * 60 * 1000);
  });

  // Not a good idea but I'm trying it anyway.
  process.on('uncaughtException', consoleCatch);
};

// Init
init();
