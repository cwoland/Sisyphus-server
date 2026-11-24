import { z } from 'zod';

export const dateRange = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}).refine(({ from, to }) => !from || !to || from <= to, 'Проверьте диапазон дат');
