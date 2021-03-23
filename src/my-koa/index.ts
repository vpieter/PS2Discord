import Koa from 'koa'
import KoaRouter from 'koa-router';
import KoaSession from 'koa-session';
import koaViews from 'koa-views';
import koaCompress from 'koa-compress';
import path from 'path';
import Grant from 'grant-koa';
import { Guild as DiscordGuild } from 'discord.js';
import { DiscordBotAppClient, DiscordBotAppSecret, DiscordRoleIdLeader, DiscordRoleIdOfficer, DiscordRoleIdSpecialist, KoaCookieKeys, KoaHost, KoaPort } from '../consts';

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

export default class MyKoa extends Koa {
  listenPort:number;

  indexRouter: MyKoaRouter;
  debugRouter: MyKoaRouter;
  publicRouter: MyKoaRouter;

  constructor(listenPort: number, discordGuild: DiscordGuild) {
    super();

    this.listenPort = listenPort;

    // Use session middleware
    this.keys = KoaCookieKeys; // .keys required for signed cookies (used by session)
    this.use(KoaSession(this));

    // Use discord oauth2 middleware
    this.use(Grant({
      "defaults": { "origin": `${KoaHost}:${KoaPort}`, "transport": "session" },
      "discord": {
        "key": DiscordBotAppClient,
        "secret": DiscordBotAppSecret,
        "scope": ["identify"],
        "response": ["tokens", "profile"],
        "callback": "/",
      },
    }));

    const staffMiddleware = async (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>, next: Koa.Next) => {
      const discordUserId = ctx.session?.grant?.response?.profile?.id;
      if (discordUserId) {
        // Permission
        const leaderRole = await discordGuild.roles.fetch(DiscordRoleIdLeader);
        const officerRole = await discordGuild.roles.fetch(DiscordRoleIdOfficer);
        const specialistRole = await discordGuild.roles.fetch(DiscordRoleIdSpecialist);
        if (discordUserId !== '101347311627534336' && // potterv override
          !leaderRole?.members.find(member => member.id === discordUserId) &&
          !officerRole?.members.find(member => member.id === discordUserId) &&
          !specialistRole?.members.find(member => member.id === discordUserId)
        ) {
          ctx.redirect('/public/unauthorized');
          return;
        }
      } else {
        ctx.redirect('/connect/discord');
        return;
      }

      await next();
    };

    // Use gzip middleware
    this.use(koaCompress());

    // Use render layout/view middleware
    const viewsPath = path.join(__dirname, '..', '..', 'web', 'views');
    const koaRender = koaViews(viewsPath, { map: { njk: 'nunjucks' }, extension: 'njk', autoRender: false, options: { settings: { views: viewsPath } } }) as Koa.Middleware;
    this.use(koaRender);

    // Use index route middleware
    this.indexRouter = new MyKoaRouter();
    this.indexRouter.use(staffMiddleware);
    this.use(this.indexRouter.routes()).use(this.indexRouter.allowedMethods());

    // Use debug route middleware
    this.debugRouter = new MyKoaRouter({ prefix: '/debug', methods: ['GET'] });
    this.debugRouter.use(staffMiddleware);
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
}
