import { IsNumber, IsPositive, IsString } from "class-validator";

export class CreateUploadRouteDto {}

export class UploadSmartContractDto {
   @IsString()
   userID: string;
   
   @IsString()
   name: string;

   @IsString()
   type: string;

   @IsString()
   linkedDevices: string;

   @IsString()
   linkedRules: string;
}

export class UploadDataDto {
   @IsString()
   userID: string;

   @IsString()
   name: string;

   @IsString()
   accessType: string;

   @IsString()
   schemaKey: string
}

export class DownloadFileDto {
   @IsString()
   key: string;

   @IsString()
   userID: string;
}