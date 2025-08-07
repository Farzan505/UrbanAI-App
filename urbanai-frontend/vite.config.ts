import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/gisportal': {
        target: 'https://gisportal-stmb.bayern.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gisportal/, ''),
        secure: false, // Allow self-signed certificates
        ws: true, // Support WebSockets if needed
        xfwd: true, // Add x-forwarded headers
        cookieDomainRewrite: 'localhost', // Rewrite cookie domain
        autoRewrite: true, // Rewrite the Location header
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
            
            // Add authentication headers if available
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
            
            // Forward cookies for ArcGIS authentication
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            
            // Add common headers needed for ArcGIS requests
            proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            proxyReq.setHeader('Referer', 'http://localhost:5173');
            proxyReq.setHeader('Origin', 'http://localhost:5173');
            
            // Add Accept headers for ArcGIS
            proxyReq.setHeader('Accept', 'application/json,application/xml,text/plain,*/*');
            
            // Log request headers for debugging
            console.log('Request Headers:', req.headers);
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url || '');
            
            // Log response headers for debugging
            const responseHeaders = proxyRes.headers;
            console.log('Response Headers:', responseHeaders);
            
            // Add CORS headers to the response
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
            
            // If this is a preflight OPTIONS request, respond immediately with 200
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
            }
            
            // Log status for debugging
            const status = proxyRes.statusCode ?? 0; // Default to 0 if statusCode is undefined
            const statusText = status >= 200 && status < 300 ? '✅' : '❌';
            console.log(`${statusText} [${status}] ${req.method} ${req.url || ''}`);
          });
        },
      }
    },
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  }
});
