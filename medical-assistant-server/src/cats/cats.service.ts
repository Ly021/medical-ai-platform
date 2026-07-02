import { Injectable } from '@nestjs/common';
import { Cat } from './cat.interface';
import { CreateCatDto } from './dto/create-cat.dto';

@Injectable()
export class CatsService {
  private cats: Cat[] = [];
  private idCounter = 1;

  findAll(): Cat[] {
    return this.cats;
  }

  create(dto: CreateCatDto): Cat {
    const cat: Cat = { id: this.idCounter++, ...dto };
    this.cats.push(cat);
    return cat;
  }
}
