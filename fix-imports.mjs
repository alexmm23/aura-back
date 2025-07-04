import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function addJsExtensions(dir) {
    const files = fs.readdirSync(dir)

    for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            addJsExtensions(fullPath)
        } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8')
            let modified = false

            // Fix @/ imports to relative paths
            const aliasRegex = /from\s+['"]@\/([^'"]*?)['"]/g
            content = content.replace(aliasRegex, (match, importPath) => {
                const relativePath = path.relative(
                    path.dirname(fullPath), 
                    path.join(__dirname, 'dist', importPath)
                ).replace(/\\/g, '/')
                modified = true
                const finalPath = relativePath.startsWith('.') ? relativePath : './' + relativePath
                return `from '${finalPath}.js'`
            })

            // Add .js extension to relative imports that don't already have it
            const relativeRegex = /from\s+['"](\.\.\?\/[^'"]*?)(?<!\.js)['"]/g
            if (relativeRegex.test(content)) {
                content = content.replace(relativeRegex, "from '$1.js'")
                modified = true
            }

            if (modified) {
                fs.writeFileSync(fullPath, content)
                console.log(`Fixed imports in ${fullPath}`)
            }
        }
    }
}

addJsExtensions('./dist')
console.log('Finished adding .js extensions to all imports')
