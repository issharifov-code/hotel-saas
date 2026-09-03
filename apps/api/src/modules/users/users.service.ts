import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from './entities/user.entity';
import { nullable } from '../../common/utils/typeorm.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async createUser(params: {
    tenantId: string | null;
    email: string;
    password: string;
    fullName: string;
    isPlatformAdmin?: boolean;
    position?: string;
  }): Promise<User> {
    const normalizedEmail = params.email.trim().toLowerCase();

    const existing = await this.userRepo.findOneBy({
      tenantId: nullable(params.tenantId),
      email: normalizedEmail,
    });
    if (existing) {
      throw new ConflictException(
        'Bu email bilan foydalanuvchi allaqachon mavjud',
      );
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      tenantId: params.tenantId,
      email: normalizedEmail,
      passwordHash,
      fullName: params.fullName,
      status: UserStatus.ACTIVE,
      isPlatformAdmin: params.isPlatformAdmin ?? false,
      position: params.position?.trim() || null,
    });
    return this.userRepo.save(user);
  }

  async findByEmailAndTenant(
    email: string,
    tenantId: string | null,
  ): Promise<User | null> {
    return this.userRepo.findOneBy({
      email: email.trim().toLowerCase(),
      tenantId: nullable(tenantId),
    });
  }

  // Login sahifasi qayta dizayni (2026-09): subdomain endi talab qilinmaydi.
  // Email bitta tenant ichida unique (@Unique(['tenantId','email'])), lekin
  // turli tenant'larda bir xil email bo'lishi mumkin — shuning uchun bu metod
  // BARCHA tenant'lardagi (va platforma admin, tenantId=null) mos foydalanuvchi
  // qatorlarini qaytaradi; qaysi biri to'g'ri ekanini AuthService parol
  // tekshiruvi orqali aniqlaydi.
  async findAllByEmail(email: string): Promise<User[]> {
    return this.userRepo.find({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOneBy({ id });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  // Xodimlar sahifasi (2026-09): administrator tomonidan yangi parol
  // o'rnatish — interim yechim, chunki hozircha email orqali o'z-o'zini
  // xizmat ko'rsatish parol tiklash mavjud emas. `tenantId` chaqiruvchining
  // (@CurrentUser) autentifikatsiyalangan tenant'idan keladi — boshqa
  // tenant'ning foydalanuvchisini o'zgartirib bo'lmaydi.
  async resetPassword(
    tenantId: string,
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId, tenantId });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.save(user);
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    status: UserStatus,
  ): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: userId, tenantId });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    user.status = status;
    return this.userRepo.save(user);
  }
}
