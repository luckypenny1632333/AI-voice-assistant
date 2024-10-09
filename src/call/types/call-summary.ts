import { z } from "zod";

export const CallSummarySchema = z.object({
  customerName: z.string(),
  customerLanguage: z.string().describe("The language the customer spoke in"),
  customerAvailability: z.string(),
  specialNotes: z.string(),
});
export type CallSummary = z.infer<typeof CallSummarySchema>;
