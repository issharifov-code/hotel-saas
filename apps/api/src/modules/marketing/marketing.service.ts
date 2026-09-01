import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DemoRequest } from './entities/demo-request.entity';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(DemoRequest)
    private readonly demoRequestRepo: Repository<DemoRequest>,
  ) {}

  async createDemoRequest(dto: CreateDemoRequestDto): Promise<DemoRequest> {
    const request = this.demoRequestRepo.create({
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      email: dto.email?.trim().toLowerCase() ?? null,
      note: dto.note?.trim() ?? null,
    });
    return this.demoRequestRepo.save(request);
  }

  async listDemoRequests(): Promise<DemoRequest[]> {
    return this.demoRequestRepo.find({ order: { createdAt: 'DESC' } });
  }

  async markContacted(id: string, contacted: boolean): Promise<DemoRequest> {
    await this.demoRequestRepo.update({ id }, { contacted });
    const updated = await this.demoRequestRepo.findOneBy({ id });
    return updated!;
  }
}
