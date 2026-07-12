import { z } from 'zod';

export const bookResourceSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  bookedForDepartmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start time must be a valid date-time string',
  }).refine((val) => new Date(val) > new Date(Date.now() - 5 * 60 * 1000), {
    // allow a 5 minute buffer for timezone lags
    message: 'Start time must be in the future',
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'End time must be a valid date-time string',
  }),
}).refine((data) => new Date(data.startTime) < new Date(data.endTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const rescheduleBookingSchema = z.object({
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start time must be a valid date-time string',
  }).refine((val) => new Date(val) > new Date(Date.now() - 5 * 60 * 1000), {
    message: 'Start time must be in the future',
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'End time must be a valid date-time string',
  }),
}).refine((data) => new Date(data.startTime) < new Date(data.endTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});
