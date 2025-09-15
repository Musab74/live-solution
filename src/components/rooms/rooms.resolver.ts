import { Resolver } from '@nestjs/graphql';
import { RoomsService } from './rooms.service';

@Resolver()
export class RoomsResolver {
  constructor(private readonly roomsService: RoomsService) {}
}
