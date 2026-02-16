/**
 * Google Calendar Integration — Shared Utilities
 *
 * Token management, API helpers, rate limiting, and type definitions
 * for syncing academic tasks with Google Calendar.
 */

// ============================================
// Type Definitions
// ============================================

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in milliseconds
  token_type: string;
  scope: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  selected?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  created?: string;
  updated?: string;
  creator?: { email: string; displayName?: string };
  organizer?: { email: string; displayName?: string };
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

export interface GoogleCalendarEventInput {
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

export interface CalendarConnectionStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
  calendars: GoogleCalendar[];
}

export type SyncDirection = 'push' | 'pull' | 'both';
export type ConflictResolution = 'keep_local' | 'keep_google' | 'ask';
export type AutoSyncInterval = '15min' | '30min' | '1hr' | 'off';

export interface CalendarSyncConfig {
  direction: SyncDirection;
  autoSync: boolean;
  autoSyncInterval: AutoSyncInterval;
  pullCalendarIds: string[];
  pushProjectIds: string[] | 'all';
  conflictResolution: ConflictResolution;
}

export interface SyncHistoryEntry {
  timestamp: string;
  direction: SyncDirection;
  pushed: number;
  pulled: number;
  errors: string[];
}

// ============================================
// Constants
// ============================================

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_OAUTH2_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** Calendar scopes needed for read/write access */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/**
 * Map project colors to Google Calendar color IDs.
 * Google Calendar has 11 predefined event colors (1-11).
 * See: https://developers.google.com/calendar/api/v3/reference/colors
 */
const COLOR_MAP: Record<string, string> = {
  '#3b82f6': '9',  // Blue -> Blueberry
  '#10b981': '10', // Green -> Basil
  '#f59e0b': '5',  // Amber -> Banana
  '#ef4444': '11', // Red -> Tomato
  '#8b5cf6': '3',  // Purple -> Grape
  '#06b6d4': '7',  // Cyan -> Peacock
  '#ec4899': '4',  // Pink -> Flamingo
  '#f97316': '6',  // Orange -> Tangerine
};

// ============================================
// Rate Limiting
// ============================================

interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

const rateLimiter: RateLimitState = {
  requestCount: 0,
  windowStart: Date.now(),
};

/** Max requests per minute to Google Calendar API */
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Check and enforce rate limiting for Google Calendar API calls.
 * Throws if rate limit would be exceeded.
 */
function checkRateLimit(): void {
  const now = Date.now();

  // Reset window if enough time has passed
  if (now - rateLimiter.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimiter.requestCount = 0;
    rateLimiter.windowStart = now;
  }

  if (rateLimiter.requestCount >= RATE_LIMIT_MAX) {
    throw new Error(
      `Google Calendar API rate limit reached (${RATE_LIMIT_MAX} requests/minute). ` +
      'Please wait before making more requests.'
    );
  }

  rateLimiter.requestCount++;
}

// ============================================
// Token Management
// ============================================

/**
 * Build the Google OAuth authorization URL.
 */
export function buildAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error(
      'Google Calendar OAuth not configured. ' +
      'Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI environment variables.'
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_OAUTH2_BASE}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google Calendar OAuth not configured. ' +
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.'
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange auth code: ${response.status} ${errorBody}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Calendar OAuth not configured. ' +
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorBody}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Refresh token doesn't change
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope || '',
  };
}

/**
 * Get a valid access token, refreshing if necessary.
 */
export async function getValidAccessToken(tokens: GoogleTokens): Promise<GoogleTokens> {
  // Add a 5-minute buffer before expiry
  const bufferMs = 5 * 60 * 1000;

  if (tokens.expires_at - bufferMs > Date.now()) {
    return tokens;
  }

  // Token is expired or about to expire, refresh it
  return refreshAccessToken(tokens.refresh_token);
}

// ============================================
// Google API Helpers
// ============================================

/**
 * Make an authenticated request to the Google Calendar API.
 */
async function googleCalendarFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  checkRateLimit();

  const url = path.startsWith('http') ? path : `${GOOGLE_CALENDAR_API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

/**
 * Fetch the authenticated user's email and profile info.
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  checkRateLimit();

  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`);
  }

  return response.json();
}

/**
 * List all calendars the user has access to.
 */
export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const response = await googleCalendarFetch('/users/me/calendarList', accessToken);

  if (!response.ok) {
    throw new Error(`Failed to list calendars: ${response.status}`);
  }

  const data = await response.json();
  return (data.items || []).map((cal: Record<string, unknown>) => ({
    id: cal.id as string,
    summary: cal.summary as string,
    description: cal.description as string | undefined,
    backgroundColor: cal.backgroundColor as string | undefined,
    foregroundColor: cal.foregroundColor as string | undefined,
    primary: cal.primary as boolean | undefined,
    accessRole: cal.accessRole as GoogleCalendar['accessRole'],
    selected: cal.selected as boolean | undefined,
  }));
}

/**
 * List events from a specific calendar within a date range.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 250
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const encodedCalId = encodeURIComponent(calendarId);
  const response = await googleCalendarFetch(
    `/calendars/${encodedCalId}/events?${params.toString()}`,
    accessToken
  );

  if (!response.ok) {
    throw new Error(`Failed to list events from ${calendarId}: ${response.status}`);
  }

  const data: GoogleCalendarListResponse = await response.json();
  return data.items || [];
}

/**
 * Create a new event in a calendar.
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput
): Promise<GoogleCalendarEvent> {
  const encodedCalId = encodeURIComponent(calendarId);
  const response = await googleCalendarFetch(
    `/calendars/${encodedCalId}/events`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create event: ${response.status} ${errorBody}`);
  }

  return response.json();
}

/**
 * Update an existing event in a calendar.
 */
export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEventInput>
): Promise<GoogleCalendarEvent> {
  const encodedCalId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  const response = await googleCalendarFetch(
    `/calendars/${encodedCalId}/events/${encodedEventId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update event: ${response.status} ${errorBody}`);
  }

  return response.json();
}

/**
 * Delete an event from a calendar.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const encodedCalId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  const response = await googleCalendarFetch(
    `/calendars/${encodedCalId}/events/${encodedEventId}`,
    accessToken,
    { method: 'DELETE' }
  );

  if (!response.ok && response.status !== 410) {
    throw new Error(`Failed to delete event: ${response.status}`);
  }
}

// ============================================
// Sync Utilities
// ============================================

/**
 * Map a project hex color to a Google Calendar color ID.
 * Returns undefined if no close match is found.
 */
export function mapProjectColorToGoogleColor(hexColor?: string): string | undefined {
  if (!hexColor) return undefined;
  const normalized = hexColor.toLowerCase();
  return COLOR_MAP[normalized] || undefined;
}

/**
 * Build a Google Calendar event payload from a task/todo.
 */
export function buildEventFromTodo(todo: {
  id: string;
  text: string;
  due_date?: string;
  notes?: string;
  project_id?: string;
}, projectColor?: string): GoogleCalendarEventInput | null {
  if (!todo.due_date) return null;

  // Use the due_date as an all-day event
  const dueDate = todo.due_date.split('T')[0]; // Ensure YYYY-MM-DD format

  // Calculate the next day for the end date (all-day events need exclusive end)
  const endDate = new Date(dueDate + 'T00:00:00');
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  const event: GoogleCalendarEventInput = {
    summary: todo.text,
    start: { date: dueDate },
    end: { date: endDateStr },
    extendedProperties: {
      private: {
        todoAppId: todo.id,
        source: 'academic-todo-app',
      },
    },
  };

  // Add notes as description, truncated to 8000 chars
  if (todo.notes) {
    event.description = todo.notes.substring(0, 8000);
  }

  // Map project color to Google Calendar color
  const googleColor = mapProjectColorToGoogleColor(projectColor);
  if (googleColor) {
    event.colorId = googleColor;
  }

  return event;
}

/**
 * Check if Google Calendar credentials are configured.
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Default sync configuration for new users.
 */
export const DEFAULT_SYNC_CONFIG: CalendarSyncConfig = {
  direction: 'push',
  autoSync: false,
  autoSyncInterval: '30min',
  pullCalendarIds: [],
  pushProjectIds: 'all',
  conflictResolution: 'keep_local',
};
