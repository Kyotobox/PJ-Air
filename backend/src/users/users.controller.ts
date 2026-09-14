import { Controller, Get, Patch, Post, Param, Body, NotFoundException, UseInterceptors, UploadedFile, BadRequestException, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { UPLOAD_PATH } from '../config';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/profile')
  async updateProfile(@Param('id') id: string, @Body() profileData: any) {
    return this.usersService.updateProfile(id, profileData);
  }

  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: string }) {
    return this.usersService.updateRole(id, body.role);
  }

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(resolve(UPLOAD_PATH), 'avatars');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        
        const ext = extname(file.originalname).toLowerCase();
        const mime = file.mimetype;

        if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
          return cb(new BadRequestException('Only image files (.jpg, .jpeg, .png, .webp, .gif) are allowed'), false);
        }
        cb(null, true);
      }
    }),
  )
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    console.log('--- Avatar Upload Request ---');
    console.log('User ID:', id);
    if (!file) {
      console.error('No file received in request');
      throw new BadRequestException('No file uploaded or file type not allowed');
    }
    console.log('File Name:', file.filename);
    console.log('File Path:', file.path);
    
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    try {
      const result = await this.usersService.updateAvatar(id, avatarUrl);
      console.log('Profile updated successfully');
      return result;
    } catch (error) {
      console.error('Database update failed:', error.message);
      throw new BadRequestException('Failed to update profile with avatar');
    }
  }

  @Patch(':id/general-discount')
  async updateGeneralDiscount(@Param('id') id: string, @Body() body: { discount: number }) {
    return this.usersService.updateGeneralDiscount(id, body.discount);
  }

  @Patch(':id/delivery-fee')
  async updateDeliveryFee(@Param('id') id: string, @Body() body: { fee: number }) {
    return this.usersService.updateDeliveryFee(id, body.fee);
  }

  @Patch(':id/min-order-amount')
  async updateMinOrderAmount(@Param('id') id: string, @Body() body: { amount: number | null }) {
    return this.usersService.updateMinOrderAmount(id, body.amount);
  }

  @Get(':id/product-discounts')
  async getProductDiscounts(@Param('id') id: string) {
    return this.usersService.getProductDiscounts(id);
  }

  @Post(':id/product-discounts')
  async setProductDiscount(@Param('id') id: string, @Body() body: { productId: number; discount_percentage?: number; special_price?: number }) {
    return this.usersService.setProductDiscount(id, body.productId, {
      discount_percentage: body.discount_percentage,
      special_price: body.special_price
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }

  @Delete('product-discounts/:discountId')
  async deleteProductDiscount(@Param('discountId') discountId: string) {
    return this.usersService.deleteProductDiscount(discountId);
  }
}
