import { IsUUID } from 'class-validator';

export class MergeGuestsDto {
  // Ikkilanma (bekor qilinadigan) mehmon ID'si — uning barcha bronlari,
  // hisob-fakturalari va loyalty tarixi asosiy mehmonga (`:id`) ko'chiriladi,
  // so'ng o'zi o'chiriladi.
  @IsUUID()
  duplicateGuestId: string;
}
