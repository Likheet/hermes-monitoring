import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pkg = require("./package.json")

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wtfnntauwvsgohfmhgyo.supabase.co",
        pathname: "/storage/v1/object/public/task-photos/**",
      },
    ],
  },
  ...(process.env.NODE_ENV === 'production' && {
    experimental: {
      optimizePackageImports: ['@/components/ui'],
    },
  }),
}

const nextVersion =
  pkg.dependencies?.next ?? pkg.devDependencies?.next ?? process.env.npm_package_dependencies_next ?? "unknown"

let finalConfig = nextConfig

try {
  const withPWA = (await import('@ducanh2912/next-pwa')).default({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'supabase-storage',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  })
  console.log('PWA configuration successful')
  finalConfig = withPWA(nextConfig)
} catch (error) {
  console.error('PWA configuration failed:', error)
  console.log('Falling back to basic Next.js config without PWA')
  finalConfig = nextConfig
}

export default finalConfig
