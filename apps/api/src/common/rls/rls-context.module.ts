import { Global, Module } from '@nestjs/common';
import { RlsContextService } from './rls-context.service';

// Global — bir marta AppModule'da import qilinadi, keyin RlsContextService
// har qanday modulga (RlsModule.forFeature ichida) inject qilinishi mumkin.
@Global()
@Module({
  providers: [RlsContextService],
  exports: [RlsContextService],
})
export class RlsContextModule {}
