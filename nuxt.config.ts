const appTitle = process.env.APP_TITLE || 'Base'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui'],

  ui: {
    theme: {
      colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'neutral', 'kashmir-blue', 'brand-slate', 'brand-success', 'brand-warning', 'brand-error', 'brand-info']
    }
  },

  ssr: false,

  css: ['~/assets/css/default.css'],

  app: {
    head: {
      title: appTitle,
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },

  nitro: {
    experimental: {
      websocket: true
    }
  },

  runtimeConfig: {
    appName: appTitle,
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,

    emailProvider: process.env.EMAIL_PROVIDER || 'smtp',
    mailgunApiKey: process.env.MAILGUN_API_KEY || '',
    mailgunDomain: process.env.MAILGUN_DOMAIN || '',
    mailgunHost: process.env.MAILGUN_HOST || '',
    awsRegion: process.env.AWS_REGION || process.env.AWS_SES_REGION || '',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',

    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpSecure: process.env.SMTP_SECURE,
    smtpFrom: process.env.SMTP_FROM,
    smtpFromName: process.env.SMTP_FROM_NAME || '',
    smtpRejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED,

    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,

    public: {
      appName: process.env.APP_TITLE,
      nodeEnv: process.env.NODE_ENV || 'development',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    }
  }
})
