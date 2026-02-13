export default defineNuxtConfig({
  extends: ['github:corsacca/nuxt-base#master'],

  devtools: { enabled: true },

  nitro: {
    experimental: {
      websocket: true
    }
  },

  runtimeConfig: {
    appName: process.env.APP_TITLE,
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpSecure: process.env.SMTP_SECURE,
    smtpFrom: process.env.SMTP_FROM,
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
