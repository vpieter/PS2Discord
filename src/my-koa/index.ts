import Koa from 'koa'
import KoaRouter from 'koa-router';
import koaViews from 'koa-views';
import koaCompress from 'koa-compress';
import path from 'path';

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

  constructor(listenPort: number) {
    super();
    
    this.listenPort = listenPort;

    this.use(koaCompress());

    const viewsPath = path.join(__dirname, '..', '..', 'web', 'views');
    const koaRender = koaViews(viewsPath, { map: { njk: 'nunjucks' }, extension: 'njk', autoRender: false, options: { settings: { views: viewsPath } } }) as Koa.Middleware;
    this.use(koaRender);

    this.indexRouter = new MyKoaRouter();
    this.use(this.indexRouter.routes()).use(this.indexRouter.allowedMethods());

    this.debugRouter = new MyKoaRouter({ prefix: '/debug', methods: ['GET'] });
    this.use(this.debugRouter.routes()).use(this.debugRouter.allowedMethods());
  }

  init() {
    this.listen(this.listenPort);
  }

  expose(name:string, obj: () => Promise<any>) {
    this.indexRouter.get(name, `/${name}`, async (ctx) => {
      ctx.body = await ctx.render('expose', { json: JSON.stringify(await obj(), null, 2), title: name } );
    });
  }

  debugExpose(name:string, obj: () => Promise<any>) {
    this.debugRouter.get(name, `/${name}`, async (ctx) => {
      ctx.body = await ctx.render('expose', { json: JSON.stringify(await obj(), null, 2), title: name } );
    });
  }
}
