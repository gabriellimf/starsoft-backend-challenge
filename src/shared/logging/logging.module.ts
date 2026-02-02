import { Global, Module, Logger } from '@nestjs/common';
import { AppLogger } from './logger.service';

@Global()
@Module({
  providers: [Logger, AppLogger],
  exports: [Logger, AppLogger],
})
export class LoggingModule {}
