import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from './entities/user.entity';
import { nullable } from '../../common/utils/typeorm.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async createUser(params: {
    tenantId: string | null;
    email: string;
    password: string;
    fullName: string;
    isPlatformAdmin?: boolean;
  }): Promise<User> {
    const normalizedEmail = params.email.trim().toLowerCase();

    const existing = await this.userRepo.findOneBy({
      tenantId: nullable(params.tenantId),
      email: normalizedEmail,
    });
    if (existing) {
      throw new ConflictException('Bu email bilan foydalanuvchi allaqachon mavjud');
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      tenantId: params.tenantId,
      email: normalizedEmail,
      passwordHash,
      fullName: params.fullName,
      status: UserStatus.ACTIVE,
      isPlatformAdmin: params.isPlatformAdmin ?? false,
    });
    return this.userRepo.save(user);
  }

  async findByEmailAndTenant(email: string, tenantId: string | null): Promise<User | null> {
    return this.userRepo.findOneBy({
      email: email.trim().toLowerCase(),
      tenantId: nullable(tenantId),
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOneBy({ id });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.userRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }
}
