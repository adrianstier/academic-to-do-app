# Data Science Analytics Schema for TaskCompletionSummary

**Version:** 1.0
**Created:** 2026-01-14
**Author:** Data Scientist
**Status:** Design Complete - Ready for Implementation
**Risk Level:** Low
**Business Impact:** Medium (Product Analytics)

---

## Executive Summary

This document defines the analytics tracking schema for the TaskCompletionSummary feature. The primary objective is to understand user behavior around summary format preferences to inform future UX decisions and feature prioritization.

### Business Questions We're Answering

1. **Which summary formats are most used?** - Informs default selection and UI prominence
2. **Do format preferences vary by user or user type?** - Enables personalization
3. **What's the copy success rate?** - Identifies technical issues
4. **How long do users spend in the summary modal?** - Measures engagement and friction
5. **Are there format-task correlations?** - Do users prefer JSON for complex tasks?

---

## 1. Event Schema Design

### 1.1 Core Analytics Events

```typescript
// Event Type Definitions
type SummaryAnalyticsEvent =
  | SummaryModalOpenedEvent
  | SummaryFormatSelectedEvent
  | SummaryCopyAttemptedEvent
  | SummaryModalClosedEvent;

interface BaseAnalyticsEvent {
  event_id: string;           // UUID for deduplication
  event_timestamp: string;    // ISO 8601 timestamp
  session_id: string;         // Browser session identifier
  user_name: string;          // Current user
  user_agent: string;         // Browser/device info
  screen_width: number;       // Viewport width (device type proxy)
}

interface SummaryModalOpenedEvent extends BaseAnalyticsEvent {
  event_type: 'summary_modal_opened';
  properties: {
    task_id: string;
    task_priority: TodoPriority;
    task_category?: TaskCategory;
    subtask_count: number;
    subtasks_completed: number;
    has_attachments: boolean;
    attachment_count: number;
    has_transcription: boolean;
    has_notes: boolean;
    initial_format: SummaryFormat;      // Format shown on open
    format_from_preference: boolean;    // Was this from localStorage?
  };
}

interface SummaryFormatSelectedEvent extends BaseAnalyticsEvent {
  event_type: 'summary_format_selected';
  properties: {
    task_id: string;
    previous_format: SummaryFormat;
    new_format: SummaryFormat;
    time_since_modal_open_ms: number;   // Milliseconds since modal opened
    selection_sequence: number;         // 1st, 2nd, 3rd format change
  };
}

interface SummaryCopyAttemptedEvent extends BaseAnalyticsEvent {
  event_type: 'summary_copy_attempted';
  properties: {
    task_id: string;
    format: SummaryFormat;
    success: boolean;
    error_type?: 'clipboard_api_failed' | 'fallback_failed' | 'permission_denied';
    copy_method: 'keyboard_shortcut' | 'button_click';
    summary_length_chars: number;
    time_since_modal_open_ms: number;
    attempt_number: number;             // Track retry attempts
  };
}

interface SummaryModalClosedEvent extends BaseAnalyticsEvent {
  event_type: 'summary_modal_closed';
  properties: {
    task_id: string;
    final_format: SummaryFormat;
    close_method: 'escape_key' | 'close_button' | 'backdrop_click';
    duration_ms: number;                // Total time modal was open
    format_changes_count: number;       // How many times format was changed
    copy_attempted: boolean;
    copy_successful: boolean;
    preview_vs_raw: 'preview' | 'raw'; // Last view state
  };
}
```

### 1.2 Aggregation-Ready Schema

For efficient querying, events should be aggregatable:

```sql
-- Proposed analytics table (if using Supabase/PostgreSQL)
CREATE TABLE summary_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id VARCHAR(100) NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  task_id UUID,

  -- Flattened properties for efficient aggregation
  format SummaryFormat,
  previous_format SummaryFormat,
  copy_success BOOLEAN,
  copy_method VARCHAR(20),
  duration_ms INTEGER,
  format_changes_count INTEGER,
  close_method VARCHAR(20),

  -- Task context (for correlation analysis)
  task_priority VARCHAR(10),
  task_category VARCHAR(30),
  subtask_count INTEGER,
  has_attachments BOOLEAN,
  has_transcription BOOLEAN,

  -- Device context
  is_mobile BOOLEAN,
  user_agent TEXT,

  -- Full properties JSONB for flexibility
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_summary_analytics_event_type ON summary_analytics_events(event_type);
CREATE INDEX idx_summary_analytics_timestamp ON summary_analytics_events(event_timestamp);
CREATE INDEX idx_summary_analytics_user ON summary_analytics_events(user_name);
CREATE INDEX idx_summary_analytics_format ON summary_analytics_events(format);
CREATE INDEX idx_summary_analytics_session ON summary_analytics_events(session_id);
```

---

## 2. Key Metrics & KPIs

### 2.1 Primary Metrics

| Metric | Definition | Success Threshold | Business Value |
|--------|------------|-------------------|----------------|
| **Format Distribution** | % of copies by format | Track trend | Inform default selection |
| **Copy Success Rate** | Successful copies / Total attempts | > 98% | Technical reliability |
| **Modal Engagement Time** | Median time from open to close | 5-30 seconds | UX friction indicator |
| **Format Exploration Rate** | % sessions with > 1 format selection | < 20% | Preference confidence |
| **Preference Persistence Adoption** | % users with stored preference | > 80% after 1 week | Feature adoption |

### 2.2 Secondary Metrics

| Metric | Definition | Purpose |
|--------|------------|---------|
| Copy Retry Rate | Attempts > 1 per session | Error detection |
| Keyboard vs Click Ratio | Copy method distribution | Power user behavior |
| Preview vs Raw Preference | Last view state at copy | UX preference |
| Mobile vs Desktop Format Preference | Format by device type | Responsive optimization |

### 2.3 Derived Metrics (Computed)

```python
# Example metric calculations (pseudocode)

def format_preference_stability(user_events: List[Event]) -> float:
    """
    Measures how consistent a user's format preference is.
    Returns 0-1 where 1 = always uses same format.
    """
    formats_used = [e.properties.format for e in user_events
                   if e.event_type == 'summary_copy_attempted' and e.properties.success]
    if not formats_used:
        return 0
    most_common = Counter(formats_used).most_common(1)[0][1]
    return most_common / len(formats_used)

def task_complexity_score(event: SummaryModalOpenedEvent) -> float:
    """
    Normalized 0-1 score of task complexity.
    Used to correlate format preference with task type.
    """
    props = event.properties
    score = 0.0
    score += min(props.subtask_count / 10, 1.0) * 0.3
    score += (1 if props.has_attachments else 0) * 0.2
    score += (1 if props.has_transcription else 0) * 0.2
    score += (1 if props.has_notes else 0) * 0.15
    score += {'low': 0, 'medium': 0.5, 'high': 0.75, 'urgent': 1}[props.task_priority] * 0.15
    return score
```

---

## 3. Data Collection Implementation

### 3.1 Client-Side Analytics Hook

```typescript
// src/hooks/useSummaryAnalytics.ts

import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Todo, SummaryFormat, TaskCategory } from '@/types/todo';

interface AnalyticsContext {
  taskId: string;
  modalOpenTime: number;
  formatChanges: number;
  copyAttempts: number;
  lastCopySuccess: boolean;
}

export function useSummaryAnalytics(todo: Todo, initialFormat: SummaryFormat) {
  const contextRef = useRef<AnalyticsContext>({
    taskId: todo.id,
    modalOpenTime: Date.now(),
    formatChanges: 0,
    copyAttempts: 0,
    lastCopySuccess: false,
  });

  const sessionId = useRef(
    typeof window !== 'undefined'
      ? sessionStorage.getItem('analytics_session_id') || uuidv4()
      : uuidv4()
  );

  // Store session ID
  if (typeof window !== 'undefined' && !sessionStorage.getItem('analytics_session_id')) {
    sessionStorage.setItem('analytics_session_id', sessionId.current);
  }

  const sendEvent = useCallback(async (event: Record<string, unknown>) => {
    // Fire-and-forget pattern - don't block UI
    try {
      await fetch('/api/analytics/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          event_id: uuidv4(),
          event_timestamp: new Date().toISOString(),
          session_id: sessionId.current,
          user_agent: navigator.userAgent,
          screen_width: window.innerWidth,
        }),
        // Use keepalive to ensure events fire even on page unload
        keepalive: true,
      });
    } catch {
      // Silent fail - analytics should never break functionality
      console.debug('Analytics event failed:', event.event_type);
    }
  }, []);

  const trackModalOpen = useCallback((formatFromPreference: boolean) => {
    sendEvent({
      event_type: 'summary_modal_opened',
      properties: {
        task_id: todo.id,
        task_priority: todo.priority,
        task_category: detectTaskCategory(todo.text), // Helper function
        subtask_count: todo.subtasks?.length || 0,
        subtasks_completed: todo.subtasks?.filter(s => s.completed).length || 0,
        has_attachments: (todo.attachments?.length || 0) > 0,
        attachment_count: todo.attachments?.length || 0,
        has_transcription: !!todo.transcription,
        has_notes: !!todo.notes,
        initial_format: initialFormat,
        format_from_preference: formatFromPreference,
      },
    });
  }, [todo, initialFormat, sendEvent]);

  const trackFormatChange = useCallback((previousFormat: SummaryFormat, newFormat: SummaryFormat) => {
    contextRef.current.formatChanges += 1;
    sendEvent({
      event_type: 'summary_format_selected',
      properties: {
        task_id: todo.id,
        previous_format: previousFormat,
        new_format: newFormat,
        time_since_modal_open_ms: Date.now() - contextRef.current.modalOpenTime,
        selection_sequence: contextRef.current.formatChanges,
      },
    });
  }, [todo.id, sendEvent]);

  const trackCopyAttempt = useCallback((
    format: SummaryFormat,
    success: boolean,
    method: 'keyboard_shortcut' | 'button_click',
    summaryLength: number,
    errorType?: string
  ) => {
    contextRef.current.copyAttempts += 1;
    contextRef.current.lastCopySuccess = success;
    sendEvent({
      event_type: 'summary_copy_attempted',
      properties: {
        task_id: todo.id,
        format,
        success,
        error_type: errorType,
        copy_method: method,
        summary_length_chars: summaryLength,
        time_since_modal_open_ms: Date.now() - contextRef.current.modalOpenTime,
        attempt_number: contextRef.current.copyAttempts,
      },
    });
  }, [todo.id, sendEvent]);

  const trackModalClose = useCallback((
    finalFormat: SummaryFormat,
    closeMethod: 'escape_key' | 'close_button' | 'backdrop_click',
    previewVsRaw: 'preview' | 'raw'
  ) => {
    sendEvent({
      event_type: 'summary_modal_closed',
      properties: {
        task_id: todo.id,
        final_format: finalFormat,
        close_method: closeMethod,
        duration_ms: Date.now() - contextRef.current.modalOpenTime,
        format_changes_count: contextRef.current.formatChanges,
        copy_attempted: contextRef.current.copyAttempts > 0,
        copy_successful: contextRef.current.lastCopySuccess,
        preview_vs_raw: previewVsRaw,
      },
    });
  }, [todo.id, sendEvent]);

  return {
    trackModalOpen,
    trackFormatChange,
    trackCopyAttempt,
    trackModalClose,
  };
}

// Helper to detect task category from text
function detectTaskCategory(text: string): TaskCategory {
  const lowered = text.toLowerCase();
  if (lowered.includes('policy') && lowered.includes('review')) return 'policy_review';
  if (lowered.includes('vehicle') || lowered.includes('car')) return 'vehicle_add';
  if (lowered.includes('new client') || lowered.includes('onboard')) return 'new_client';
  if (lowered.includes('claim')) return 'claim';
  if (lowered.includes('payment') || lowered.includes('billing')) return 'payment';
  if (lowered.includes('quote')) return 'quote';
  if (lowered.includes('document') || lowered.includes('paperwork')) return 'documentation';
  if (lowered.includes('follow up') || lowered.includes('call back')) return 'follow_up';
  return 'other';
}
```

### 3.2 API Endpoint

```typescript
// src/app/api/analytics/summary/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const event = await request.json();

    // Validate required fields
    if (!event.event_type || !event.event_id || !event.session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract flattened fields for efficient querying
    const flattenedData = {
      id: event.event_id,
      event_type: event.event_type,
      event_timestamp: event.event_timestamp,
      session_id: event.session_id,
      user_name: event.user_name || 'anonymous',
      task_id: event.properties?.task_id,
      format: event.properties?.format || event.properties?.new_format || event.properties?.final_format,
      previous_format: event.properties?.previous_format,
      copy_success: event.properties?.success,
      copy_method: event.properties?.copy_method,
      duration_ms: event.properties?.duration_ms,
      format_changes_count: event.properties?.format_changes_count,
      close_method: event.properties?.close_method,
      task_priority: event.properties?.task_priority,
      task_category: event.properties?.task_category,
      subtask_count: event.properties?.subtask_count,
      has_attachments: event.properties?.has_attachments,
      has_transcription: event.properties?.has_transcription,
      is_mobile: event.screen_width ? event.screen_width < 768 : null,
      user_agent: event.user_agent,
      properties: event.properties,
    };

    const { error } = await supabase
      .from('summary_analytics_events')
      .insert(flattenedData);

    if (error) {
      logger.error('Failed to insert analytics event', error, { component: 'SummaryAnalytics' });
      return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Analytics endpoint error', error, { component: 'SummaryAnalytics' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 4. Analysis Queries

### 4.1 Format Distribution Dashboard

```sql
-- Overall format distribution (last 30 days)
SELECT
  format,
  COUNT(*) as copy_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM summary_analytics_events
WHERE event_type = 'summary_copy_attempted'
  AND copy_success = true
  AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY format
ORDER BY copy_count DESC;

-- Format preference by user
SELECT
  user_name,
  format,
  COUNT(*) as times_used,
  ROW_NUMBER() OVER (PARTITION BY user_name ORDER BY COUNT(*) DESC) as rank
FROM summary_analytics_events
WHERE event_type = 'summary_copy_attempted'
  AND copy_success = true
GROUP BY user_name, format
HAVING ROW_NUMBER() OVER (PARTITION BY user_name ORDER BY COUNT(*) DESC) = 1;
```

### 4.2 Copy Success Rate Monitoring

```sql
-- Daily copy success rate
SELECT
  DATE(event_timestamp) as date,
  COUNT(*) FILTER (WHERE copy_success = true) as successful,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE copy_success = true) / COUNT(*), 2) as success_rate
FROM summary_analytics_events
WHERE event_type = 'summary_copy_attempted'
  AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(event_timestamp)
ORDER BY date DESC;

-- Error type breakdown
SELECT
  properties->>'error_type' as error_type,
  COUNT(*) as occurrences,
  COUNT(DISTINCT session_id) as affected_sessions
FROM summary_analytics_events
WHERE event_type = 'summary_copy_attempted'
  AND copy_success = false
  AND event_timestamp > NOW() - INTERVAL '7 days'
GROUP BY properties->>'error_type'
ORDER BY occurrences DESC;
```

### 4.3 User Engagement Analysis

```sql
-- Average time spent in modal by format
SELECT
  final_format.format,
  ROUND(AVG(duration_ms) / 1000.0, 2) as avg_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) / 1000.0 as median_seconds,
  COUNT(*) as sessions
FROM (
  SELECT
    properties->>'final_format' as format,
    duration_ms
  FROM summary_analytics_events
  WHERE event_type = 'summary_modal_closed'
    AND duration_ms IS NOT NULL
) final_format
GROUP BY final_format.format
ORDER BY avg_seconds DESC;

-- Format exploration rate
SELECT
  CASE
    WHEN format_changes_count = 0 THEN 'No exploration'
    WHEN format_changes_count = 1 THEN '1 change'
    WHEN format_changes_count = 2 THEN '2 changes'
    ELSE '3+ changes'
  END as exploration_level,
  COUNT(*) as sessions,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM summary_analytics_events
WHERE event_type = 'summary_modal_closed'
  AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY
  CASE
    WHEN format_changes_count = 0 THEN 'No exploration'
    WHEN format_changes_count = 1 THEN '1 change'
    WHEN format_changes_count = 2 THEN '2 changes'
    ELSE '3+ changes'
  END
ORDER BY sessions DESC;
```

### 4.4 Task Complexity Correlation

```sql
-- Format preference by task complexity
WITH task_complexity AS (
  SELECT
    task_id,
    CASE
      WHEN (subtask_count > 5 OR has_attachments OR has_transcription) THEN 'complex'
      WHEN (subtask_count > 0 OR task_priority IN ('high', 'urgent')) THEN 'medium'
      ELSE 'simple'
    END as complexity
  FROM summary_analytics_events
  WHERE event_type = 'summary_modal_opened'
)
SELECT
  tc.complexity,
  sae.format,
  COUNT(*) as copies,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY tc.complexity), 2) as pct_within_complexity
FROM summary_analytics_events sae
JOIN task_complexity tc ON sae.task_id = tc.task_id
WHERE sae.event_type = 'summary_copy_attempted'
  AND sae.copy_success = true
GROUP BY tc.complexity, sae.format
ORDER BY tc.complexity, copies DESC;
```

---

## 5. Privacy & Data Governance

### 5.1 Data Retention Policy

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Raw events | 90 days | Detailed debugging |
| Aggregated metrics | 2 years | Trend analysis |
| User-level summaries | 1 year | Personalization |

### 5.2 PII Handling

- **NO** task text is stored in analytics (only task_id reference)
- **NO** notes or transcription content
- User names are pseudonymized after 90 days
- IP addresses are NOT collected

### 5.3 Consent & Compliance

```typescript
// Analytics only fire if user hasn't opted out
const ANALYTICS_OPT_OUT_KEY = 'analytics_opt_out';

export function isAnalyticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) !== 'true';
}
```

---

## 6. Monitoring & Alerting

### 6.1 Anomaly Detection Thresholds

| Metric | Alert Threshold | Severity |
|--------|-----------------|----------|
| Copy success rate | < 95% for 1 hour | High |
| Copy success rate | < 90% for 15 min | Critical |
| Modal open rate drops | > 50% day-over-day | Medium |
| Error rate spike | > 10x baseline | High |

### 6.2 Dashboard Refresh Schedule

| Dashboard | Refresh Frequency | Audience |
|-----------|-------------------|----------|
| Real-time copy success | 1 minute | Engineering |
| Daily format distribution | Hourly | Product |
| Weekly trends | Daily | Leadership |

---

## 7. Implementation Recommendation

### Phase 1: Foundation (Optional - Skip if limited resources)

The analytics schema is designed but **implementation is optional** for the current TaskCompletionSummary UX improvements. The feature can ship without analytics.

### Phase 2: If Implementing

1. **Database migration**: Create `summary_analytics_events` table
2. **API endpoint**: Implement `/api/analytics/summary`
3. **Client hook**: Add `useSummaryAnalytics` to component
4. **Dashboard**: Create Supabase or Metabase dashboard

### Estimated Effort

| Task | Effort | Priority |
|------|--------|----------|
| Schema migration | 1 hour | Optional |
| API endpoint | 2 hours | Optional |
| Client integration | 3 hours | Optional |
| Dashboard setup | 4 hours | Optional |
| **Total** | **10 hours** | **Future sprint** |

---

## 8. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Data Scientist | | 2026-01-14 | Design Complete |
| Tech Lead | | | Pending Review |
| Product Manager | | | Pending Prioritization |

---

**Document Prepared By:** Data Scientist
**Next Steps:** Product prioritization decision on analytics implementation
**Recommendation:** Defer analytics to future sprint, proceed with UX improvements

