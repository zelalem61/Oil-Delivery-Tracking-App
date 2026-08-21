import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './auth.dto';
@ApiTags('auth') @Controller('auth')
export class AuthController { constructor(private readonly auth: AuthService) {} @Post('login') @ApiOperation({ summary: 'Authenticate user' }) login(@Body() body: LoginDto) { return this.auth.login(body.email, body.password); } @Post('refresh') refresh(@Body() body: RefreshDto) { return this.auth.refresh(body.refreshToken); } @Post('logout') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth() async logout(@Req() req: { user: { sub: string } }) { await this.auth.logout(req.user.sub); return { success: true, data: null }; } }
