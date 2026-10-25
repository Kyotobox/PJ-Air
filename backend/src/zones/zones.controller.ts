import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get('resolve')
  async resolve(@Query('zip') zip: string, @Query('orFail') orFail?: string) {
    if (!zip || !zip.trim()) {
      throw new BadRequestException('Query parameter "zip" is required');
    }

    const zone = await this.zonesService.resolveZip(zip);
    if (!zone) {
      if (orFail === 'true' || orFail === '1') {
        throw new NotFoundException(`No delivery zone found for ZIP "${zip}"`);
      }
      return null;
    }
    return zone;
  }

  @Get()
  async findAll() {
    return this.zonesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updatePut(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updatePatch(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    await this.zonesService.delete(id);
    return { success: true, message: `Zone ${id} deleted successfully` };
  }
}
