export async function getZoomToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoom auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function createZoomMeeting(params: {
  title: string;
  startTime: Date;
  durationMinutes: number;
  hostEmail: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<{ meetingId: string; joinUrl: string; hostUrl: string }> {
  const token = await getZoomToken();

  const res = await fetch(`https://api.zoom.us/v2/users/${params.hostEmail}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: params.title,
      type: 2, // Scheduled meeting
      start_time: params.startTime.toISOString(),
      duration: params.durationMinutes,
      timezone: "America/New_York",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
        auto_recording: "none",
        registrants_email_notification: false,
      },
    }),
  });

  const data = await res.json();
  if (!data.join_url) throw new Error(`Zoom meeting creation failed: ${JSON.stringify(data)}`);

  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    hostUrl: data.start_url,
  };
}
