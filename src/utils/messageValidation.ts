/**
 * Utilidades para validación de mensajes de chat
 */

// Lista de palabras altisonantes en español e inglés
const PROFANITY_LIST = [
  // Español
  'puto',
  'puta',
  'pendejo',
  'pendeja',
  'cabrón',
  'cabrona',
  'mierda',
  'joder',
  'coño',
  'verga',
  'chingada',
  'chingar',
  'culero',
  'culera',
  'pinche',
  'mamada',
  'huevón',
  'huevona',
  'idiota',
  'imbécil',
  'estúpido',
  'estúpida',
  'hijo de puta',
  'hdp',
  'hp',
  'ctm',
  'ctmr',
  'malparido',
  'malparida',
  'gonorrea',
  'hijueputa',
  'güey',
  'wey',
  'baboso',
  'babosa',
  'zorra',
  'perra',
  
  // Inglés
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'damn',
  'crap',
  'dick',
  'pussy',
  'cock',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'slut',
  'whore',
]

// Regex para validar caracteres permitidos
// Permite: letras (español e inglés), números, espacios, puntuación básica
const ALLOWED_CHARACTERS_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,;:!?¿¡()\-'"]+$/

/**
 * Valida que el mensaje solo contenga caracteres permitidos
 */
export function validateCharacters(message: string): {
  valid: boolean
  error?: string
} {
  if (!message || message.trim().length === 0) {
    return {
      valid: false,
      error: 'El mensaje no puede estar vacío',
    }
  }

  // Verificar longitud máxima
  if (message.length > 255) {
    return {
      valid: false,
      error: 'El mensaje no puede exceder 255 caracteres',
    }
  }

  // Verificar caracteres permitidos
  if (!ALLOWED_CHARACTERS_REGEX.test(message)) {
    return {
      valid: false,
      error: 'El mensaje contiene caracteres no permitidos. Solo se permiten letras, números y puntuación básica',
    }
  }

  // Verificar que no sea solo espacios
  if (message.trim().length === 0) {
    return {
      valid: false,
      error: 'El mensaje no puede contener solo espacios',
    }
  }

  // Verificar caracteres invisibles o fantasma (Zero-width, non-breaking spaces, etc.)
  const invisibleCharsRegex = /[\u200B-\u200D\uFEFF\u00A0]/g
  if (invisibleCharsRegex.test(message)) {
    return {
      valid: false,
      error: 'El mensaje contiene caracteres invisibles no permitidos',
    }
  }

  return { valid: true }
}

/**
 * Detecta palabras altisonantes en el mensaje
 */
export function containsProfanity(message: string): {
  hasProfanity: boolean
  words?: string[]
} {
  const normalizedMessage = message.toLowerCase()
  const foundWords: string[] = []

  for (const word of PROFANITY_LIST) {
    // Crear regex para detectar la palabra con variaciones
    // Permite detectar con o sin espacios extra, caracteres especiales, etc.
    const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    
    if (wordRegex.test(normalizedMessage)) {
      foundWords.push(word)
    }
  }

  return {
    hasProfanity: foundWords.length > 0,
    words: foundWords.length > 0 ? foundWords : undefined,
  }
}

/**
 * Limpia el mensaje eliminando espacios extra y caracteres invisibles
 */
export function cleanMessage(message: string): string {
  // Eliminar caracteres invisibles
  let cleaned = message.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
  
  // Reemplazar múltiples espacios por uno solo
  cleaned = cleaned.replace(/\s+/g, ' ')
  
  // Eliminar espacios al inicio y final
  cleaned = cleaned.trim()
  
  return cleaned
}

/**
 * Valida el mensaje completo: caracteres y profanidad
 */
export function validateMessage(message: string): {
  valid: boolean
  error?: string
  cleaned?: string
} {
  // Primero limpiar el mensaje
  const cleaned = cleanMessage(message)

  // Validar caracteres
  const charValidation = validateCharacters(cleaned)
  if (!charValidation.valid) {
    return {
      valid: false,
      error: charValidation.error,
    }
  }

  // Validar profanidad
  const profanityCheck = containsProfanity(cleaned)
  if (profanityCheck.hasProfanity) {
    return {
      valid: false,
      error: `El mensaje contiene lenguaje inapropiado. Por favor, mantén un tono respetuoso`,
    }
  }

  return {
    valid: true,
    cleaned,
  }
}

/**
 * Censurar palabras altisonantes reemplazándolas con asteriscos (alternativa)
 */
export function censorProfanity(message: string): string {
  let censored = message

  for (const word of PROFANITY_LIST) {
    const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    censored = censored.replace(wordRegex, (match) => '*'.repeat(match.length))
  }

  return censored
}
