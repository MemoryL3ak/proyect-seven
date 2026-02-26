import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccreditationsService } from './accreditations.service';
import { CreateAccreditationDto } from './dto/create-accreditation.dto';
import { IssueCredentialDto } from './dto/issue-credential.dto';
import { QueryAccreditationsDto } from './dto/query-accreditations.dto';
import { RejectAccreditationDto } from './dto/reject-accreditation.dto';
import { ReviewAccreditationDto } from './dto/review-accreditation.dto';
import { UpdateAccreditationDto } from './dto/update-accreditation.dto';

@Controller('accreditations')
export class AccreditationsController {
  constructor(private readonly accreditationsService: AccreditationsService) {}

  @Post()
  create(@Body() dto: CreateAccreditationDto) {
    return this.accreditationsService.create(dto);
  }

  @Get()
  findAll(@Query() filters: QueryAccreditationsDto) {
    return this.accreditationsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accreditationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccreditationDto) {
    return this.accreditationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accreditationsService.remove(id);
  }

  @Post(':id/review')
  setInReview(@Param('id') id: string, @Body() dto: ReviewAccreditationDto) {
    return this.accreditationsService.setInReview(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewAccreditationDto) {
    return this.accreditationsService.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectAccreditationDto) {
    return this.accreditationsService.reject(id, dto);
  }

  @Post(':id/issue-credential')
  issueCredential(@Param('id') id: string, @Body() dto: IssueCredentialDto) {
    return this.accreditationsService.issueCredential(id, dto);
  }
}
