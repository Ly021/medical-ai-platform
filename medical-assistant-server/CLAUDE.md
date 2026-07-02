# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run start:dev     # 开发模式（热重载）
npm run build         # 编译到 dist/
npm run start:prod    # 生产启动（需先 build）
npm run test          # 运行单元测试（jest）
npm run test:e2e      # 端到端测试
npm run test:cov      # 单元测试 + 覆盖率
npm run lint          # ESLint 检查 + 自动修复
npm run format        # Prettier 格式化
```

## Architecture

**NestJS 11（Express 平台）**，模块化架构，功能模块独立目录。

**运行时流程：**
```
请求 → Middleware（记录日志）→ Controller（路由处理）→ Service（业务逻辑）→ 响应
```

### 目录结构

```
medical-assistant-server/
├── src/
│   ├── main.ts                      # 入口文件，创建 Nest 应用并监听 3000 端口
│   ├── app.module.ts                # 根模块，注册所有子模块和中间件
│   ├── app.controller.ts            # 根控制器，处理 GET / 请求
│   ├── app.controller.spec.ts       # 根控制器单元测试
│   ├── app.service.ts               # 根服务，提供 getHello() 方法
│   ├── cats/                        # Cats 功能模块（独立模块参考模板）
│   │   ├── cats.module.ts           # 模块定义，组装 controller + service
│   │   ├── cats.controller.ts       # 控制器，处理 GET /cats 请求
│   │   └── cats.service.ts          # 服务层，实现 findAll() 业务逻辑
│   └── common/                      # 公共资源（跨模块共享）
│       └── middleware/              # 自定义中间件
│           └── logger.middleware.ts  # 日志中间件，拦截请求打印日志后放行
├── test/                            # 端到端测试
│   ├── app.e2e-spec.ts              # E2E 测试用例
│   └── jest-e2e.json                # E2E 测试的 Jest 配置
├── dist/                            # 编译产物（npm run build 生成）
├── nest-cli.json                    # Nest CLI 配置
├── tsconfig.json                    # TypeScript 编译配置
├── tsconfig.build.json              # 生产构建配置
├── eslint.config.mjs                # ESLint 规则（typed checking）
└── .prettierrc                      # Prettier 格式化规则
```

### 各层职责

| 层 | 装饰器 | 职责 | 类比 Java |
|---|---|---|---|
| Module | `@Module()` | 组织代码单元，声明本模块的 controller/service，引入依赖模块 | `@Configuration` + DI |
| Controller | `@Controller('path')` | 定义路由，接收请求，调用 service，返回响应 | `@RestController` |
| Service | `@Injectable()` | 封装业务逻辑，可被 controller 或其他 service 注入 | `@Service` |
| Middleware | `@Injectable()` + `NestMiddleware` | 请求前后拦截处理（日志、权限、限流等） | `Filter` / `Interceptor` |
| DTO | `class` | 定义请求/响应的数据结构 | DTO |
| Interface | `interface` | 定义内部类型（如 Cat 对象结构） | POJO / Entity |

### 约定

- 新建功能模块：在 `src/` 下创目录（如 `src/users/`），包含 `.module.ts`、`.controller.ts`、`.service.ts`，再在 `AppModule.imports` 中注册
- 中间件放在 `src/common/middleware/`，通过 `AppModule.configure()` 注册
- DTO 定义接口数据格式，interface 定义内部类型

### NestJS 11 注意

- 模块解析使用 `nodenext`，target `ES2023`
- `@nestjs/common` v11 配合 `@types/express` v5，Express 5 API
- ESLint 使用 `typescript-eslint` v8 typed checking，`any` 已关闭报错
