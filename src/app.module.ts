import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatsModule } from './cats/cats.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [CatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('cats');
  }
}

// // forRoutes() 方法接受一个字符串、一个数组或者一个 RouteInfo 对象，来指定哪些路由需要使用这个中间件。在上面的例子中，我们指定了 'cats' 路由，这意味着所有以 /cats 开头的请求都会经过 LoggerMiddleware 中间件进行处理。
// // 1. 字符串路径
// forRoutes('cats');             // 只拦截 /cats
// forRoutes('cats', 'dogs');    // 拦截 /cats 和 /dogs

// // 2. 指定 HTTP 方法
// forRoutes({ path: 'cats', method: RequestMethod.POST });  // 只拦截 POST /cats

// // 3. 指定 Controller 类
// forRoutes(CatsController);     // 拦截这个 Controller 下的所有路由

// // 4. 所有路由
// forRoutes('*');               // 拦截全部请求