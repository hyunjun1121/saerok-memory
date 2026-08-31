import { randomBytes } from 'node:crypto'

const ENROLLMENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ENROLLMENT_CODE_LENGTH = 8

export function generateEnrollmentCode(): string {
  const bytes = randomBytes(ENROLLMENT_CODE_LENGTH)
  return Array.from(
    bytes,
    (value) => ENROLLMENT_CODE_ALPHABET[value & 31],
  ).join('')
}
