import { IsString } from 'class-validator';

export class PreviewDto {
  @IsString()
  source: string;
}
