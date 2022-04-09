import Koa, { Context, DefaultState, ParameterizedContext } from 'koa'
import KoaRouter from 'koa-router';
import KoaSession from 'koa-session';
import koaViews from 'koa-views';
import koaCompress from 'koa-compress';
import path from 'path';
import Grant, { GrantResponse } from 'grant';
import { Guild as DiscordGuild } from 'discord.js';
import { DiscordBotAppClient, DiscordBotAppSecret, DiscordRoleIdLeader, DiscordRoleIdMember, DiscordRoleIdOfficer, DiscordRoleIdSpecialist, KoaCookieKeys, KoaHost, KoaPort } from '../consts';
import { Modify } from '../utils';
import Router from 'koa-router';

export type MyKoaUser = {
  name: string | null;
  color: string | null;

  isDev: boolean;
  isStaff: boolean;
  isMember: boolean;
  isConnected: boolean;
}

export class MyKoaRouter extends KoaRouter<Koa.DefaultState, Koa.Context> {
  constructor(opt?: KoaRouter.IRouterOptions) {
    super(opt);
  }

  disable(route: KoaRouter.Layer) {
    if (!route.path.startsWith('#')) {
      route.setPrefix('#');
    }
  }

  enable(route: KoaRouter.Layer) {
    if (route.path.startsWith('#')) {
      route.path = route.path.replace('#', '');
      route.regexp = new RegExp(route.regexp.source.replace('#', ''), route.regexp.flags);
    }
  }
}

// tslint:disable-next-line: max-classes-per-file
export default class MyKoa extends Koa {
  listenPort: number;
  discordGuild: DiscordGuild;

  indexRouter: MyKoaRouter;
  debugRouter: MyKoaRouter;
  publicRouter: MyKoaRouter;

  constructor(listenPort: number, discordGuild: DiscordGuild) {
    super();

    this.listenPort = listenPort;
    this.discordGuild = discordGuild;

    // Use session middleware
    this.keys = KoaCookieKeys; // .keys required for signed cookies (used by session)
    this.use(KoaSession(this));

    // Use discord oauth2 middleware
    this.use(Grant.koa(({
      "defaults": { "origin": `${KoaHost}:${KoaPort}`, "transport": "session" },
      "discord": {
        "key": DiscordBotAppClient,
        "secret": DiscordBotAppSecret,
        "scope": ["identify"],
        "response": ["tokens", "profile"],
        "callback": "/",
      },
    })));

    this.use(this.userMiddleware);

    // Use gzip middleware
    this.use(koaCompress());

    // Use render layout/view middleware
    const viewsPath = path.join(__dirname, '..', '..', 'web', 'views');
    const koaRender = koaViews(viewsPath, { map: { njk: 'nunjucks' }, extension: 'njk', autoRender: false, options: { settings: { views: viewsPath } } }) as Koa.Middleware;
    this.use(koaRender);

    // Use index route middleware
    this.indexRouter = new MyKoaRouter();
    this.indexRouter.use(this.staffMiddleware);
    this.use(this.indexRouter.routes()).use(this.indexRouter.allowedMethods());

    // Use debug route middleware
    this.debugRouter = new MyKoaRouter({ prefix: '/debug', methods: ['GET'] });
    this.debugRouter.use(this.devMiddleware);
    this.use(this.debugRouter.routes()).use(this.debugRouter.allowedMethods());

    // Use public route middleware
    this.publicRouter = new MyKoaRouter({ prefix: '/public', methods: ['GET'] });
    this.use(this.publicRouter.routes()).use(this.publicRouter.allowedMethods());
    this.publicRouter.get('unauthorized', '/unauthorized', async (ctx) => {
      ctx.status = 403;
      ctx.body = 'Unauthorized';
    });
  }

  init() {
    this.listen(this.listenPort);
  }

  expose(name:string, obj: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.Context & KoaRouter.IRouterParamContext<Koa.DefaultState, Koa.Context>>) => Promise<any>) {
    this.indexRouter.get(name, `/${name}`, async (ctx) => {
      ctx.body = await ctx.render('expose', { json: JSON.stringify(await obj(ctx), null, 2), title: name } );
    });
  }

  debugExpose(name:string, obj: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.Context & KoaRouter.IRouterParamContext<Koa.DefaultState, Koa.Context>>) => Promise<any>) {
    this.debugRouter.get(name, `/${name}`, async (ctx) => {
      ctx.body = await ctx.render('expose', { json: JSON.stringify(await obj(ctx), null, 2), title: name } );
    });
  }

  publicExpose(name:string, obj: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.Context & KoaRouter.IRouterParamContext<Koa.DefaultState, Koa.Context>>) => Promise<any>) {
    this.publicRouter.get(name, `/${name}`, async (ctx) => {
      ctx.body = await ctx.render('expose', { json: JSON.stringify(await obj(ctx), null, 2), title: name } );
    });
  }

  devMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
    if (!ctx.state.user.isConnected) return ctx.redirect('/connect/discord');
    else if (!ctx.state.user.isDev) return ctx.redirect('/public/unauthorized');
    await next();
  };

  staffMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
    if (!ctx.state.user.isConnected) return ctx.redirect('/connect/discord');
    else if (!ctx.state.user.isStaff) return ctx.redirect('/public/unauthorized');
    await next();
  };

  memberMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
    if (!ctx.state.user.isConnected) return ctx.redirect('/connect/discord');
    else if (!ctx.state.user.isMember) return ctx.redirect('/public/unauthorized');
    await next();
  };

  connectedMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
    if (!ctx.state.user.isConnected) return ctx.redirect('/public/unauthorized');
    await next();
  };

  private userMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
    const user: MyKoaUser = {
      name: null,
      color: null,

      isDev: false,
      isStaff: false,
      isMember: false,
      isConnected: false,
    };

    const staffRoleIds = [DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist];
    const discordUserId = ctx.session?.grant?.response?.profile?.id;
    if (discordUserId)  {
      const guildMember = await this.discordGuild.members.fetch(discordUserId);

      user.name = guildMember.nickname;
      user.color = guildMember.displayHexColor;

      user.isDev = guildMember.id === '101347311627534336';
      user.isStaff = guildMember.roles.cache.some(r => staffRoleIds.includes(r.id));
      user.isMember = guildMember.roles.cache.has(DiscordRoleIdMember);
      user.isConnected = true;
    }

    ctx.state.user = user;
    await next();
  };
}

export type MyGrantResponse = Modify<GrantResponse, {
  profile: MyGrantDiscordProfile;
}>;

export type MyGrantDiscordProfile = {
  "id": string,
  "username": string,
  "avatar": string,
  "discriminator": string,
  "public_flags": number,
  "flags": number,
  "locale": string,
  "mfa_enabled": boolean,
};

export function getGrantDiscordProfile(ctx: ParameterizedContext<DefaultState, Context & Router.IRouterParamContext<DefaultState, Context>>): MyGrantDiscordProfile {
  const response: MyGrantResponse = ctx.session?.grant.response;

  return response.profile;
}
