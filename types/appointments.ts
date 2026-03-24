export interface Appt {
  id: string; clientName: string; clientEmail: string; clientCompany: string;
  clientWhatsapp: string; platform: string; scheduledAt: string; status: string;
  outcome: string | null; leadScore: string; serviceInterest: string | null;
  repName: string | null; repSlug: string | null; assignedTo: string | null;
  notes: string | null; nextStep: string | null;
  confirmToken: string | null; meetingLink: string | null;
  clientNotes: string | null;
  partnerSlug: string | null;
}
