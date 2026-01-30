import { Global, Module } from '@nestjs/common';

import { LockService } from './locks.service';

@Global()
@Module({
  providers: [LockService],
  exports: [LockService],
})
export class LocksModule {}
