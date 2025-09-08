import { PartialType } from '@nestjs/mapped-types';
import { CreateUploadRouteDto } from './create-upload-route.dto';

export class UpdateUploadRouteDto extends PartialType(CreateUploadRouteDto) {}
