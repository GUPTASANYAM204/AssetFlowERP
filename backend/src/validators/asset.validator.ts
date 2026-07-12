import { z } from 'zod';

export const registerAssetSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  categoryId: z.string().uuid('Invalid category ID'),
  serialNumber: z.string().optional().nullable(),
  acquisitionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Acquisition date must be a valid YYYY-MM-DD date string',
  }),
  acquisitionCost: z.number().nonnegative('Acquisition cost cannot be negative'),
  condition: z.enum(['New', 'Good', 'Fair', 'Poor'], {
    errorMap: () => ({ message: 'Condition must be New, Good, Fair, or Poor' }),
  }),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  photoUrl: z.string().url('Invalid photo URL format').optional().nullable().or(z.literal('')),
  isSharedBookable: z.boolean().default(false),
  categoryFields: z.record(z.any()).default({}),
});

export const updateAssetStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'], {
    errorMap: () => ({ message: 'Invalid asset lifecycle status' }),
  }),
});
