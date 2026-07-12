import { z } from 'zod';

export const raiseMaintenanceSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL' }),
  }),
  photoUrl: z.string().url('Invalid photo URL').optional().nullable().or(z.literal('')),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED'], {
    errorMap: () => ({ message: 'Invalid maintenance request status' }),
  }),
  technicianId: z.string().uuid('Invalid technician ID').optional().nullable(),
  cost: z.number().nonnegative('Cost cannot be negative').optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
});
