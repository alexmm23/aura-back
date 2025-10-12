import https from 'https'
import http from 'http'
import FormData from 'form-data'
import fs from 'fs'
import env from '../config/enviroment.js'

const PYTHON_API_URL = env.AURA_AI_API_URL

/**
 * Procesa una imagen con OCR
 */
export const processImageOCR = async (imagePath: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Archivo no encontrado: ${imagePath}`)
      }

      const form = new FormData()
      form.append('file', fs.createReadStream(imagePath))

      const url = new URL('/ocr/', PYTHON_API_URL)
      const protocol = url.protocol === 'https:' ? https : http

      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        headers: form.getHeaders(),
      }

      const req = protocol.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(result)
            } else {
              reject(new Error(`Error ${res.statusCode}: ${JSON.stringify(result)}`))
            }
          } catch (error) {
            reject(new Error(`Error parsing response: ${data}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Error en la petición: ${error.message}`))
      })

      form.pipe(req)
    } catch (error: any) {
      reject(error)
    }
  })
}

/**
 * Procesa una imagen con OCR y genera material de estudio
 */
export const processImageStudy = async (
  imagePath: string,
  numQuestions: number = 5
): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Archivo no encontrado: ${imagePath}`)
      }

      const form = new FormData()
      form.append('file', fs.createReadStream(imagePath))

      const url = new URL('/ocr/study', PYTHON_API_URL)
      url.searchParams.append('num_questions', numQuestions.toString())
      
      const protocol = url.protocol === 'https:' ? https : http

      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: form.getHeaders(),
      }

      const req = protocol.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(result)
            } else {
              reject(new Error(`Error ${res.statusCode}: ${JSON.stringify(result)}`))
            }
          } catch (error) {
            reject(new Error(`Error parsing response: ${data}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Error en la petición: ${error.message}`))
      })

      form.pipe(req)
    } catch (error: any) {
      reject(error)
    }
  })
}

/**
 * Verifica el estado de la API de Python
 */
export const checkAuraAIHealth = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL('/health', PYTHON_API_URL)
      const protocol = url.protocol === 'https:' ? https : http

      const options = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
      }

      const req = protocol.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(result)
            } else {
              reject(new Error(`Error ${res.statusCode}: ${JSON.stringify(result)}`))
            }
          } catch (error) {
            reject(new Error(`Error parsing response: ${data}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Error en la petición: ${error.message}`))
      })

      req.end()
    } catch (error: any) {
      reject(error)
    }
  })
}