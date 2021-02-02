import KoaRouter from 'koa-router';

export default class MyKoaRouter extends KoaRouter {
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
