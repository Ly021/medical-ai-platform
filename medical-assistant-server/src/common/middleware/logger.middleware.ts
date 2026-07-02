import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('=============================');
    console.log(`[${new Date().toISOString()}] 收到请求`);
    console.log(`方法: ${req.method}`);
    console.log(`路径: ${req.url}`);
    console.log(`查询参数:`, req.query);
    console.log(`请求体:`, req.body);
    console.log('=============================');
    next();
  }
}
