import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max } from 'class-validator';

export class CreateCatDto {
  @ApiProperty({ description: '猫的名字', example: 'Tom' })
  @IsString()
  name: string;

  @ApiProperty({ description: '猫的年龄', example: 2 })
  @IsInt()
  @Min(0)
  @Max(30)
  age: number;

  @ApiProperty({ description: '猫的品种', example: '橘猫' })
  @IsString()
  breed: string;
}
