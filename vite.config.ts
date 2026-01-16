import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { vitePluginTypescriptTransform } from 'vite-plugin-typescript-transform'

// https://vite.dev/config/
export default defineConfig({
    define: {
        'process': JSON.stringify({ env: {} })
    },
    plugins: [
        // TypeScript transform plugin to run RTTI transformer
        vitePluginTypescriptTransform({
            enforce: 'pre',
            filter: {
                files: {
                    include: ['**/*.ts', '**/*.tsx'],
                },
            },
            tsconfig: {
                location: resolve(__dirname, 'tsconfig.build.json'),
            },
        }),
        react(),
    ],
    build: {
        emptyOutDir: false,
        copyPublicDir: false,
        rollupOptions: {
            external: ['react', 'react/jsx-runtime', 'react-dnd', 'react-dnd-html5-backend'],
            output: {
                assetFileNames: 'assets/[name][extname]',
                entryFileNames: '[name].js',
            }
        },
        lib: {
            entry: resolve(__dirname, 'lib/main.ts'),
            formats: ['es']
        }
    }
})
