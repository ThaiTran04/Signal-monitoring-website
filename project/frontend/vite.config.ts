import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Listen on 0.0.0.0 (all network interfaces), not just localhost — needed
  // so other devices on the LAN (phone, tablet, another PC) can open the
  // dashboard via http://<this-PC's-LAN-IP>:5173. With the default
  // localhost-only binding, `npm run dev` is only ever reachable from the
  // same machine it's running on. Run `ipconfig` (Windows) / `ifconfig` or
  // `ip addr` (Linux/Mac) on this machine to find that LAN IP.
  server: {
    host: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
