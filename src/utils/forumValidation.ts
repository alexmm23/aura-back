/**
 * Validaciones y sanitización de contenido relacionado con foros
 */

import { containsProfanity } from './messageValidation.js'

const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF\u00A0]/g

interface ValidationOptions {
  fieldLabel: string
  maxLength: number
  allowEmpty?: boolean
  optional?: boolean
}

const sanitizeBaseText = (value: string): string => {
  return value
    .normalize('NFC')
    .replace(INVISIBLE_CHAR_REGEX, '')
    .replace(/\r\n/g, '\n')
}

const validateForumField = (
  value: string | null | undefined,
  { fieldLabel, maxLength, allowEmpty = false, optional = false }: ValidationOptions,
): string | undefined => {
  if (value === undefined || value === null) {
    if (optional) {
      return undefined
    }
    throw new Error(`${fieldLabel} is required`)
  }

  const sanitized = sanitizeBaseText(value)
  const trimmed = sanitized.trim()

  if (!allowEmpty && trimmed.length === 0) {
    throw new Error(`${fieldLabel} cannot be empty`)
  }

  if (allowEmpty && trimmed.length === 0) {
    return ''
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldLabel} cannot exceed ${maxLength} characters`)
  }

  const profanityCheck = containsProfanity(trimmed)
  if (profanityCheck.hasProfanity) {
    throw new Error(`${fieldLabel} contains inappropriate language`)
  }

  return trimmed
}

export const validateForumTitle = (title: string): string => {
  const validated = validateForumField(title, {
    fieldLabel: 'Forum title',
    maxLength: 150,
  })
  return validated ?? ''
}

export const validateForumDescription = (description?: string | null): string | undefined => {
  return validateForumField(description ?? undefined, {
    fieldLabel: 'Forum description',
    maxLength: 6000,
    allowEmpty: true,
    optional: true,
  })
}

export const validateForumMetadataField = (
  value: string | null | undefined,
  fieldLabel: string,
): string | undefined => {
  return validateForumField(value ?? undefined, {
    fieldLabel,
    maxLength: 120,
    allowEmpty: true,
    optional: true,
  })
}

export const validatePostTitle = (title: string): string => {
  const validated = validateForumField(title, {
    fieldLabel: 'Post title',
    maxLength: 180,
  })
  return validated ?? ''
}

export const validatePostDescription = (description?: string | null): string | undefined => {
  return validateForumField(description ?? undefined, {
    fieldLabel: 'Post description',
    maxLength: 8000,
    allowEmpty: true,
    optional: true,
  })
}

export const validateCommentContent = (content: string): string => {
  const validated = validateForumField(content, {
    fieldLabel: 'Comment content',
    maxLength: 4000,
  })
  return validated ?? ''
}
