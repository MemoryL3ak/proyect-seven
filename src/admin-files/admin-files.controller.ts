import { Controller, Get } from '@nestjs/common';
import { StaffOnly } from '../auth/staff-only.decorator';
import { AdminFilesService } from './admin-files.service';

/** Inventario de archivos subidos: sólo el panel de administración. */
@StaffOnly()
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly service: AdminFilesService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}
