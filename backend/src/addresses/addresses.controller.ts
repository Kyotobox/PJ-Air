import { Controller, Post, Body, Get, Param, Delete, Patch, UseGuards, Req, ForbiddenException, UseInterceptors, UploadedFile, BadRequestException, Optional } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { UPLOAD_PATH } from '../config';
import { AddressesService } from './addresses.service';
import { AddressValidationService } from './address-validation.service';
import { AuthGuard } from '../auth/auth.guard';
import { ResourceOwnershipGuard } from '../auth/resource-ownership.guard';

@Controller('addresses')
@UseGuards(AuthGuard)
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    @Optional()
    private readonly addressValidationService?: AddressValidationService,
  ) {}

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(resolve(UPLOAD_PATH), 'addresses');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file type not allowed');
    }
    return { url: `/uploads/addresses/${file.filename}` };
  }

  @Post('validate')
  async validateAddress(@Body() body: any) {
    if (!body?.address) {
      throw new BadRequestException('El campo "address" es obligatorio para la validación.');
    }
    if (!this.addressValidationService) {
      return { valid: true, address: body.address };
    }
    const result = await this.addressValidationService.validateAndGeocode(
      body.address,
      body.lat,
      body.lng,
    );
    return { valid: true, ...result };
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const targetUserId = (req.user?.role === 'admin' && body.userId) ? body.userId : req.user.id;
    const { userId, ...addressData } = body;
    return this.addressesService.create(targetUserId, addressData);
  }

  @Get('user/:userId')
  @UseGuards(ResourceOwnershipGuard)
  async findByUser(@Param('userId') userId: string, @Req() req: any) {
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      throw new ForbiddenException('Cannot access other user addresses');
    }
    return this.addressesService.findByUser(userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const address = await this.addressesService.findOne(id);
    if (req.user?.role !== 'admin' && address.user_id !== req.user.id) {
      throw new ForbiddenException('Cannot modify other user addresses');
    }
    const { userId, ...addressData } = body;
    return this.addressesService.update(id, addressData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const address = await this.addressesService.findOne(id);
    if (req.user?.role !== 'admin' && address.user_id !== req.user.id) {
      throw new ForbiddenException('Cannot delete other user addresses');
    }
    return this.addressesService.delete(id);
  }
}
