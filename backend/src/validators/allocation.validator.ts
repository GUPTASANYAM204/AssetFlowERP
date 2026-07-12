import { z } from 'zod';

export const allocateAssetSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  userId: z.string().uuid('Invalid user ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  expectedReturnAt: z.string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Expected return date must be a valid date string' })
    .refine((val) => new Date(val) > new Date(), { message: 'Expected return date must be in the future' })
    .optional()
    .nullable(),
}).refine((data) => (data.userId && !data.departmentId) || (!data.userId && data.departmentId), {
  message: 'Must allocate to either a User OR a Department, but not both',
  path: ['userId'],
});

export const returnAssetSchema = z.object({
  checkInNotes: z.string().optional().nullable(),
  condition: z.enum(['New', 'Good', 'Fair', 'Poor'], {
    errorMap: () => ({ message: 'Condition must be New, Good, Fair, or Poor' }),
  }).optional(),
});

export const transferRequestSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  toUserId: z.string().uuid('Invalid user ID').optional().nullable(),
  toDepartmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters long'),
}).refine((data) => (data.toUserId && !data.toDepartmentId) || (!data.toUserId && data.toDepartmentId), {
  message: 'Must transfer to either a User OR a Department, but not both',
  path: ['toUserId'],
});

export const approveTransferSchema = z.object({
  approved: z.boolean(),
  approvalNotes: z.string().optional().nullable(),
});
