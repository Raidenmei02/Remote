import type { EnvironmentRecord, SessionEventRecord } from '../../shared/protocol'
import type { EventListResponse, SessionDetail, SessionSummary } from '../types'
import { basePath } from '../utils/storage'
import { tryParse } from '../utils/json'

type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

export function requestJson<T>(
  path: string,
  baseUrl: string,
  options: RequestOptions = {},
): Promise<T> {
  return fetch(`${basePath(baseUrl)}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  }).then(async response => {
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `${response.status} ${response.statusText}${text ? `: ${text}` : ''}`,
      )
    }

    if (response.status === 204) {
      return null as T
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>
    }

    const text = await response.text()
    return (text ? tryParse<T>(text) ?? (text as T) : null) as T
  })
}

export function fetchOverview(baseUrl: string) {
  return Promise.all([
    requestJson<EnvironmentRecord[] | { data?: EnvironmentRecord[] }>(
      '/v1/environments',
      baseUrl,
    ),
    requestJson<SessionSummary[] | { data?: SessionSummary[] }>('/v1/sessions', baseUrl),
  ]).then(([environmentsResponse, sessionsResponse]) => ({
    environments: Array.isArray(environmentsResponse)
      ? environmentsResponse
      : Array.isArray(environmentsResponse?.data)
        ? environmentsResponse.data
        : [],
    sessions: Array.isArray(sessionsResponse)
      ? sessionsResponse
      : Array.isArray(sessionsResponse?.data)
        ? sessionsResponse.data
        : [],
  }))
}

export function fetchSessionDetail(baseUrl: string, sessionId: string) {
  return Promise.all([
    requestJson<SessionDetail>(`/v1/sessions/${encodeURIComponent(sessionId)}`, baseUrl),
    requestJson<EventListResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/events`,
      baseUrl,
    ).catch(() => [] as SessionEventRecord[]),
  ]).then(([session, events]) => ({ session, events }))
}

export function createSession(
  baseUrl: string,
  environmentId: string,
  title: string,
) {
  return requestJson<{ id: string }>('/v1/sessions', baseUrl, {
    method: 'POST',
    body: {
      environment_id: environmentId,
      ...(title.trim() ? { title: title.trim() } : {}),
    },
  })
}

export async function stopOrHideSession(baseUrl: string, sessionId: string) {
  const detail = await requestJson<SessionDetail>(
    `/v1/sessions/${encodeURIComponent(sessionId)}`,
    baseUrl,
  )
  const activeWork = Array.isArray(detail.workItems)
    ? detail.workItems.find(item => item && item.state !== 'completed')
    : null

  if (activeWork?.environmentId && activeWork.id) {
    await requestJson(
      `/v1/environments/${encodeURIComponent(activeWork.environmentId)}/work/${encodeURIComponent(activeWork.id)}/stop`,
      baseUrl,
      {
        method: 'POST',
        body: { force: true },
      },
    )

    return { removedRemotely: true }
  }

  return { removedRemotely: false }
}

export function sendUserMessage(baseUrl: string, sessionId: string, text: string) {
  return requestJson(
    `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
    baseUrl,
    {
      method: 'POST',
      body: {
        events: [
          {
            type: 'user',
            uuid: `web_${crypto.randomUUID().replaceAll('-', '')}`,
            message: { content: text },
            source: 'web',
          },
        ],
      },
    },
  )
}
