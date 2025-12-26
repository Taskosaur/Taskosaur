// Mock S3Service before any imports to avoid ESM module issues
jest.mock('../storage/s3.service', () => ({
  S3Service: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn(),
    getSignedUrl: jest.fn(),
    deleteFile: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { TaskSharesController } from './task-shares.controller';
import { PublicSharedTasksService } from '../public/services/public-shared-tasks.service';
import { CreatePublicTaskShareDto } from '../public/dto/public-shared-task.dto';

describe('TaskSharesController', () => {
  let controller: TaskSharesController;
  let mockPublicSharedTasksService: jest.Mocked<PublicSharedTasksService>;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    role: 'USER',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
  };

  const mockRequest = {
    user: mockUser,
  } as unknown as Request;

  beforeEach(async () => {
    const mockService = {
      createShareLink: jest.fn(),
      getSharesForTask: jest.fn(),
      revokeShare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskSharesController],
      providers: [
        {
          provide: PublicSharedTasksService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TaskSharesController>(TaskSharesController);
    mockPublicSharedTasksService = module.get(PublicSharedTasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createShare', () => {
    it('should create a public share link', async () => {
      const dto: CreatePublicTaskShareDto = {
        taskId: 'task-id',
        expiresInDays: 7,
      };

      const expectedResult = {
        id: 'share-id',
        token: 'token',
        shareUrl: 'http://localhost:3000/public/task/token',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      mockPublicSharedTasksService.createShareLink.mockResolvedValue(expectedResult);

      const result = await controller.createShare(dto, mockRequest);

      expect(mockPublicSharedTasksService.createShareLink).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getSharesForTask', () => {
    it('should get all active share links for a task', async () => {
      const taskId = 'task-id';
      const expectedResult = [
        {
          id: 'share-id',
          token: 'token',
          shareUrl: 'http://localhost:3000/public/task/token',
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockPublicSharedTasksService.getSharesForTask.mockResolvedValue(expectedResult);

      const result = await controller.getSharesForTask(taskId, mockRequest);

      expect(mockPublicSharedTasksService.getSharesForTask).toHaveBeenCalledWith(
        taskId,
        mockUser.id,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('revokeShare', () => {
    it('should revoke a public share link', async () => {
      const shareId = 'share-id';

      mockPublicSharedTasksService.revokeShare.mockResolvedValue(undefined);

      const result = await controller.revokeShare(shareId, mockRequest);

      expect(mockPublicSharedTasksService.revokeShare).toHaveBeenCalledWith(shareId, mockUser.id);
      expect(result).toEqual({ message: 'Share link revoked successfully' });
    });
  });
});
