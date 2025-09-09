import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Res, BadRequestException, Query, ParseIntPipe } from '@nestjs/common';
import { UploadRouteService } from './upload-route.service';
import { DownloadFileDto, UploadDataDto, UploadSmartContractDto } from './dto/create-upload-route.dto';
import { UpdateUploadRouteDto } from './dto/update-upload-route.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as mime from 'mime-types';
import path from 'path';

@Controller('uploads')
export class UploadRouteController {
  constructor(private readonly uploadRouteService: UploadRouteService) { }

  // 🔹 Allowed extensions
  private allowedExtensions = ['.json', '.csv', '.sol', '.abi', '.txt', '.xml', '.xls', '.xlsx'];
  private validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) throw new BadRequestException(`Invalid file type. Allowed: ${this.allowedExtensions.join(', ')}`);
    if (file.size > 15 * 1024 * 1024) throw new BadRequestException('File size exceeds 15MB limit');
    return true;
  }

  // 🔹 Upload smart contract file
  @Post('upload-smart-contract')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSmartContract(@UploadedFile() file: Express.Multer.File, @Body() uploadSmartContractDto: UploadSmartContractDto) {
    this.validateFile(file);
    return this.uploadRouteService.uploadSmartContract(file, uploadSmartContractDto);
  }

  // 🔹 Upload data file
  @Post('upload-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadData(@UploadedFile() file: Express.Multer.File, @Body() uploadDataDto: UploadDataDto) {
    this.validateFile(file);
    return this.uploadRouteService.uploadData(file, uploadDataDto);
  }

  // 🔹 Get all smart contract file info
  @Get('all-smart-contracts')
  async getAllUserSmartContracts(
    @Query('userId') userId: string,
    @Query('limit', ParseIntPipe) limit: number,
    @Query('page', ParseIntPipe) page: number,
  ) {
    return await this.uploadRouteService.getAllUserSmartContracts(userId, limit ?? 50, page ?? 1);
  }

  // 🔹 Get smart contract file info
  @Get('smart-contract')
  async getUserSmartContractById(
    @Query('id', ParseIntPipe) id: number,
    @Query('userID') userID: string
  ) {
    return await this.uploadRouteService.getUserSmartContractById(id, userID);
  }

  // 🔹 Get all uploaded data file info
  @Get('all-uploaded-data')
  async getAllUserUploadededData(
    @Query('userId') userId: string,
    @Query('limit', ParseIntPipe) limit: number,
    @Query('page', ParseIntPipe) page: number,
  ) {
    return await this.uploadRouteService.getAllUserUploadededData(userId, limit ?? 50, page ?? 1);
  }

  // 🔹 Get uploaded data file info
  @Get('uploaded-data')
  async getUserUploadededDataById(
    @Query('id', ParseIntPipe) id: number,
    @Query('userID') userID: string
  ) {
    return await this.uploadRouteService.getUserUploadededDataById(id, userID);
  }

  // 🔹 Download file by key
  @Get('download-file')
  async downloadFile(
    @Res() res: Response,
    @Query('key') key: string,
    @Query('userID') userID: string
  ) {
    const fileBuffer = await this.uploadRouteService.downloadFile(key, userID);

    const contentType = mime.lookup(key) || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${key}"`,
    });

    res.send(fileBuffer);
  }
}
