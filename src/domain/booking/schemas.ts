import { z } from "zod";

export const BookingStatusSchema = z.enum([
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
  "CHECKED_IN",
  "NO_SHOW",
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const SessionStatusSchema = z.enum([
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const CreateBookingInputSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  turnstileToken: z.string().trim().min(1).optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

export const CancelBookingInputSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  reason: z.string().trim().max(240).optional(),
});
export type CancelBookingInput = z.infer<typeof CancelBookingInputSchema>;

export const VerifyQrCheckInInputSchema = z.object({
  qrToken: z.string().trim().min(1, "QR token is required"),
  sessionId: z.string().uuid("Invalid session ID"),
});
export type VerifyQrCheckInInput = z.infer<typeof VerifyQrCheckInInputSchema>;

export const CreateSessionInputSchema = z
  .object({
    schoolId: z.string().uuid(),
    gradeId: z.string().uuid(),
    subjectId: z.string().uuid(),
    hallId: z.string().uuid(),
    teacherId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    bufferMinutes: z.number().int().min(0).max(180).default(15),
    capacity: z.number().int().min(1).max(2000),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .refine((data) => data.startsAt.getTime() < data.endsAt.getTime(), {
    message: "Session end time must be strictly after start time",
    path: ["endsAt"],
  });
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;
