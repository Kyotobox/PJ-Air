import { Controller, Post, Body, Get, Param, Delete, Patch, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AuthGuard } from '../auth/auth.guard';
import { ResourceOwnershipGuard } from '../auth/resource-ownership.guard';

@Controller('addresses')
@UseGuards(AuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

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
