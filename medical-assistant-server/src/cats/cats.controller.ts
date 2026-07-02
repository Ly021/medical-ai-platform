import { Controller, Get, Post, HttpStatus, UseFilters, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './cat.interface';

@ApiTags('Cats')
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @ApiOperation({ summary: '查询所有猫' })
  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @ApiOperation({ summary: '查看 HTTP 状态码枚举' })
  @Get('status')
  getStatus() {
    return HttpStatus;
  }

  @ApiOperation({ summary: '创建一只猫' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @Post()
  async create(@Body() createCatDto: CreateCatDto): Promise<Cat> {
    return this.catsService.create(createCatDto);
  }
}
