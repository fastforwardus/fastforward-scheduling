import { google } from "googleapis";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state: userId,
  });
}

export async function createMeetEvent(params: {
  refreshToken: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
  attendeeName: string;
  description?: string;
}) {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: params.refreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: params.title,
      description: params.description || "",
      start: { dateTime: params.startTime.toISOString() },
      end:   { dateTime: params.endTime.toISOString() },
      attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
      conferenceData: {
        createRequest: {
          requestId: `ff-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });

  const meetLink = event.data.conferenceData?.entryPoints?.find(
    e => e.entryPointType === "video"
  )?.uri || "";

  return { eventId: event.data.id || "", meetLink };
}
