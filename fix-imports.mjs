import fs from 'fs'
import path from 'path'

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

            // Add .js extension to relative imports that don't already have it
            const regex = /from\s+['"](\.\.\?\/[^'"]*?)(?<!\.js)['"]/g
            if (regex.test(content)) {
                content = content.replace(regex, "from '$1.js'")
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
