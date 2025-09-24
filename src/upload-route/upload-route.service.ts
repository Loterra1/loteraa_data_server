import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UploadDataDto, UploadSmartContractDto } from './dto/create-upload-route.dto';
import { smartContractTable, dataFilesTable } from './entities/upload-route.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FilebaseService } from 'src/common/primary_services/filebase/Filebase.service';
import { AIValidationService } from 'src/common/primary_services/openai/openai.service';
import { WalletSystemService } from 'src/common/primary_services/wallet-systems/WalletSystem.service';
import { OnchainTransactionsService } from 'src/onchain-transactions/onchain-transactions.service';

@Injectable()
export class UploadRouteService {
  constructor(
    @InjectRepository(smartContractTable)
    private smartContractRepo: Repository<smartContractTable>,
    @InjectRepository(dataFilesTable)
    private dataFilesRepo: Repository<dataFilesTable>,
    private readonly filebaseService: FilebaseService,
    private readonly AI_Service: AIValidationService,
    private readonly walletSystem: WalletSystemService,
    private readonly onChainService: OnchainTransactionsService
  ) { }

  async uploadSmartContract(file: Express.Multer.File, uploadSmartContractDto: UploadSmartContractDto) {
    const { mimetype } = file;
    const { userID, name, type, linkedDevices, linkedRules } = uploadSmartContractDto
    const { key, cid } = await this.filebaseService.uploadFile(file);
    const intLinkedDevices = parseInt(linkedDevices)
    if (isNaN(intLinkedDevices)) throw new ConflictException('linkedDevices must be a number string');
    const newRecord = this.smartContractRepo.create({ userID, name, contractType: type, linkedDevices: intLinkedDevices, linkedRules, mimetype, CID: cid ?? undefined, uploadAccessKey: key })
    await this.smartContractRepo.save(newRecord);
    return { message: 'Smart contract uploaded successfully', success: true, data: newRecord };
  }

  async uploadData(file: Express.Multer.File, uploadDataDto: UploadDataDto) {
    const { mimetype } = file;
    const { userID, name, accessType, schemaKey } = uploadDataDto
    const { valid: Validation, totalRecords, errors, rowReports } = this.filebaseService.validateFile(file, schemaKey) // Minimum Total Records should be defined

    // Schema Validation
    if(!Validation) throw new UnprocessableEntityException({ message: 'Schema Validation Failed', details: { errors, rowReports } });

    // AI Validation
    const AI_Validation = await this.AI_Service.checkFile(file)
    const hasIssues = AI_Validation.some(r =>
      Object.values(r.issues).some(arr => arr.length > 0),
    );
    if(hasIssues || AI_Validation) throw new UnprocessableEntityException({ message: 'AI Validation Failed', details: { ...AI_Validation } });
    console.log('Post AI validation')


    //Get User Wallet Details for performing reward
    const userAddress = await this.onChainService.getUserWallet(uploadDataDto.userID)

    console.log('Pre Reward Contract')
    //Reward User for data upload
    const rewardTxt = await this.walletSystem.rewardUser(userAddress.data.address)
    console.log('Post Reward Contract')

    const { key, cid } = await this.filebaseService.uploadFile(file);
    const newRecord = this.dataFilesRepo.create({ userID, name, accessType, mimetype, CID: cid ?? undefined, uploadAccessKey: key })
    await this.dataFilesRepo.save(newRecord);
    return { message: 'Data file uploaded successfully', success: true, data: { ...newRecord, rewardTxt } };
  }

  async getUserSmartContractById(id: number, userID: string) {
    const record = await this.smartContractRepo.findOne({ where: { id, userID } })
    if (!record) throw new NotFoundException('smart Contract not found');
    return { message: 'Smart contract retrieved successfully', success: true, data: record };
  }

  async getAllUserSmartContracts(userID: string, limit: number = 50, page: number = 1) {
    limit = Math.max(1, Math.min(limit, 100))
    page = Math.max(1, page)
    const offset = (page - 1) * limit;
    const [record, total] = await Promise.all([
      this.smartContractRepo.find({
        where: { userID },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      }),
      this.smartContractRepo.count({ where: { userID } })
    ]);
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    return {
      message: 'All Smart contracts retrieved successfully', success: true, data: {
        record,
        page,
        total,
        totalPages,
        user: {
          userID
        }
      }
    };
  }

  async getUserUploadededDataById(id: number, userID: string) {
    const record = await this.dataFilesRepo.findOne({ where: { id, userID } })
    if (!record) throw new NotFoundException('Data file not found');
    return { message: 'User Data File retrieved successfully', success: true, data: record };
  }

  async getAllUserUploadededData(userID: string, limit: number = 50, page: number = 1) {
    limit = Math.max(1, Math.min(limit, 100))
    page = Math.max(1, page)
    const offset = (page - 1) * limit;
    const [record, total] = await Promise.all([
      this.dataFilesRepo.find({
        where: { userID },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      }),
      this.dataFilesRepo.count({ where: { userID } })
    ]);
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    return {
      message: 'All User Data Files retrieved successfully', success: true, data: {
        record,
        page,
        total,
        totalPages,
        user: {
          userID
        }
      }
    };
  }

  async downloadFile(key: string, userID: string) {
    const record = await this.smartContractRepo.findOne({ where: { uploadAccessKey: key, userID } }) ?? await this.dataFilesRepo.findOne({ where: { uploadAccessKey: key, userID } });
    if (!record) throw new NotFoundException('File not found or access denied');
    return this.filebaseService.downloadFile(key);
  }
}
