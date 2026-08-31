import { timingSafeEqual } from 'node:crypto'

import type { DataPlaneRuntime } from './runtime'
import { createRuntime } from './runtime'
import { DataPlaneRepositoryError } from './repository'

export interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query: Record<string, string | string[] | undefined>
}

export interface ApiResult {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

export interface VercelResponseLike {
  status(code: number): VercelResponseLike
  setHeader(name: string, value: string): void
  json(body: Record<string, unknown>): void
}

export type ApiRoute = (
  request: ApiRequest,
  runtime: DataPlaneRuntime,
) => Promise<ApiResult>

export const HARU_DEVICE_COOKIE = 'haru_device'

export function result(
  status: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): ApiResult {
  return { status, body, ...(headers ? { headers } : {}) }
}

export function methodNotAllowed(allowed: string): ApiResult {
  return result(405, { error: 'method_not_allowed' }, { allow: allowed })
}

export function bearerToken(request: ApiRequest): string | undefined {
  const raw = Object.entries(request.headers).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )?.[1]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value?.startsWith('Bearer ')) return undefined
  const token = value.slice(7).trim()
  return token.length >= 24 && token.length <= 256 ? token : undefined
}

export function internalBearerAuthorized(
  request: ApiRequest,
  expectedSecret: string,
): boolean {
  const raw = Object.entries(request.headers).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )?.[1]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return false
  const expected = `Bearer ${expectedSecret}`
  const actualBytes = Buffer.from(value)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

function cookieToken(request: ApiRequest): string | undefined {
  const raw = Object.entries(request.headers).find(
    ([name]) => name.toLowerCase() === 'cookie',
  )?.[1]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return undefined
  for (const part of value.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    const token = part.slice(separator + 1).trim()
    if (name === HARU_DEVICE_COOKIE && token.length >= 24 && token.length <= 256) {
      return token
    }
  }
  return undefined
}

export function jsonBody(request: ApiRequest): unknown {
  if (typeof request.body !== 'string') return request.body
  try {
    return JSON.parse(request.body) as unknown
  } catch {
    return undefined
  }
}

export async function deviceTokenHash(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<string | undefined> {
  const token = bearerToken(request) ?? cookieToken(request)
  return token ? runtime.hashSecret(`device:${token}`) : undefined
}

export function repositoryFailure(error: unknown): ApiResult {
  if (error instanceof DataPlaneRepositoryError) {
    if (error.code === 'unauthorized') return result(401, { error: error.code })
    if (error.code === 'consent_required') return result(403, { error: error.code })
    if (error.code === 'not_found') return result(404, { error: error.code })
    if (error.code === 'invalid_or_expired_enrollment_code') {
      return result(401, { error: error.code })
    }
  }
  return result(503, { error: 'data_plane_unavailable' })
}

export function createVercelHandler(route: ApiRoute) {
  return async function handler(request: ApiRequest, response: VercelResponseLike) {
    const resolution = createRuntime(process.env)
    const apiResult = resolution.ok
      ? await route(request, resolution.runtime).catch(repositoryFailure)
      : result(503, { error: resolution.reason })

    for (const [name, value] of Object.entries(apiResult.headers ?? {})) {
      response.setHeader(name, value)
    }
    response.setHeader('cache-control', 'no-store')
    response.status(apiResult.status).json(apiResult.body)
  }
}
