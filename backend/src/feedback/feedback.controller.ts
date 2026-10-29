import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() body: { category: string; message: string; userId?: string }, @Req() req: any) {
    const userId = req.user?.id || body.userId;
    return this.feedbackService.create({
      userId,
      category: body.category,
      message: body.message,
    });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    return this.feedbackService.findAll();
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.feedbackService.updateStatus(id, status);
  }
}
