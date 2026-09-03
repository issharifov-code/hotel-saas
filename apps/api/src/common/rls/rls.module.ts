import { DynamicModule, Module, Provider, Scope } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntitySchema } from 'typeorm';
import { RlsContextService } from './rls-context.service';

// @nestjs/typeorm'ning ichki `EntityClassOrSchema` turi tashqariga eksport
// qilinmagan — shu yerda mos keladigan minimal turni o'zimiz belgilaymiz
// (haqiqiy entity klasslari yoki EntitySchema instansiyalari).
type EntityLike = (new (...args: any[]) => object) | EntitySchema<any>;

/**
 * `TypeOrmModule.forFeature([...])`ning RLS-himoyalangan varianti.
 *
 * Farqi: bu yerda qaytariladigan repository'lar REQUEST scope'da va
 * `RlsContextService` orqali ochilgan (tenant_id sessiyaga yozilgan)
 * tranzaksiyaning EntityManager'idan olinadi. Servis kodida ESA hech narsa
 * o'zgarmaydi — `@InjectRepository(Entity)` bilan xuddi avvalgidek ishlaydi,
 * chunki DI token (`getRepositoryToken(Entity)`) bir xil qoladi.
 *
 * `RlsContextService` global (`RlsContextModule` — AppModule'da bir marta
 * import qilinadi) bo'lgani uchun bu yerda uni alohida import qilish shart
 * emas.
 *
 * Faqat operatsion (tenant_id RLS siyosati qo'llangan) jadvallar uchun
 * ishlatiladi — qarang: EnableRowLevelSecurity migratsiyasi.
 */
@Module({})
export class RlsModule {
  static forFeature(entities: EntityLike[]): DynamicModule {
    const tokens = entities.map((entity) => getRepositoryToken(entity));
    const providers: Provider[] = entities.map((entity, i) => ({
      provide: tokens[i],
      scope: Scope.REQUEST,
      useFactory: async (rlsContext: RlsContextService) => {
        const manager = await rlsContext.getManager();
        return manager.getRepository(entity as never);
      },
      inject: [RlsContextService],
    }));

    return {
      module: RlsModule,
      providers,
      exports: tokens,
    };
  }
}
