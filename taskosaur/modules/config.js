require('dotenv').config();
const path = require('path');

/**
 * Process environment variables - global variables are those without BE_ or FE_ prefix
 */
function processEnvironment() {
    return process.env;
}

/**
 * Get configuration with defaults
 */
function getConfig() {
    const processedEnv = processEnvironment();
    
    const {
        // Global/Proxy configuration (no prefix)
        APP_HOST = '127.0.0.1',
        APP_PORT = '9100',
        
        // Backend configuration (with BE_ prefix)
        BE_HOST = '127.0.0.1',
        BE_PORT = '9101',
        BE_UNIX_SOCKET = '1',
        BE_UNIX_SOCKET_PATH = path.join(process.cwd(), 'backend', 'tmp', 'taskosaur-backend.sock'),
        
        // Frontend configuration (with FE_ prefix)
        FE_HOST = '127.0.0.1',
        FE_PORT = '9102',
        FE_UNIX_SOCKET = '1',
        FE_UNIX_SOCKET_PATH = path.join(process.cwd(), 'frontend', 'tmp', 'taskosaur-frontend.sock'),
        
        // Backend-specific environment variables (with BE_ prefix)
        BE_DATABASE_URL,
        BE_JWT_SECRET,
        BE_JWT_REFRESH_SECRET,
        BE_JWT_EXPIRES_IN = '15m',
        BE_JWT_REFRESH_EXPIRES_IN = '7d',
        BE_REDIS_HOST = 'localhost',
        BE_REDIS_PORT = '6379',
        BE_REDIS_PASSWORD,
        BE_SMTP_HOST,
        BE_SMTP_PORT,
        BE_SMTP_USER,
        BE_SMTP_PASS,
        BE_SMTP_FROM,
        BE_FRONTEND_URL,
        BE_UPLOAD_DEST = './uploads',
        BE_MAX_FILE_SIZE = '10485760',
        BE_MAX_CONCURRENT_JOBS = '5',
        BE_JOB_RETRY_ATTEMPTS = '3',
        BE_QUEUE_REDIS_URL,
        BE_CORS_ORIGIN,
        
        // Frontend-specific environment variables (with FE_ prefix)
        FE_NEXT_PUBLIC_API_BASE_URL = '/api',
        FE_NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID,
        FE_NEXT_PUBLIC_APP_URL,
        FE_NEXT_PUBLIC_APP_NAME,
        FE_NEXT_PUBLIC_ENABLE_AUTOMATION,
    } = processedEnv;

    return {
        // Global/Proxy configuration
        APP_HOST: APP_HOST,
        APP_PORT: APP_PORT,
        
        // Backend configuration
        BE_HOST: BE_HOST,
        BE_PORT: BE_PORT,
        BE_UNIX_SOCKET,
        BE_UNIX_SOCKET_PATH,
        
        // Frontend configuration  
        FE_HOST: FE_HOST,
        FE_PORT: FE_PORT,
        FE_UNIX_SOCKET,
        FE_UNIX_SOCKET_PATH,
        
        // Backend environment variables (mapped from BE_ prefix)
        DATABASE_URL: BE_DATABASE_URL,
        JWT_SECRET: BE_JWT_SECRET,
        JWT_REFRESH_SECRET: BE_JWT_REFRESH_SECRET,
        JWT_EXPIRES_IN: BE_JWT_EXPIRES_IN,
        JWT_REFRESH_EXPIRES_IN: BE_JWT_REFRESH_EXPIRES_IN,
        REDIS_HOST: BE_REDIS_HOST,
        REDIS_PORT: BE_REDIS_PORT,
        REDIS_PASSWORD: BE_REDIS_PASSWORD,
        SMTP_HOST: BE_SMTP_HOST,
        SMTP_PORT: BE_SMTP_PORT,
        SMTP_USER: BE_SMTP_USER,
        SMTP_PASS: BE_SMTP_PASS,
        SMTP_FROM: BE_SMTP_FROM,
        FRONTEND_URL: BE_FRONTEND_URL,
        UPLOAD_DEST: BE_UPLOAD_DEST,
        MAX_FILE_SIZE: BE_MAX_FILE_SIZE,
        MAX_CONCURRENT_JOBS: BE_MAX_CONCURRENT_JOBS,
        JOB_RETRY_ATTEMPTS: BE_JOB_RETRY_ATTEMPTS,
        QUEUE_REDIS_URL: BE_QUEUE_REDIS_URL,
        CORS_ORIGIN: BE_CORS_ORIGIN,
        
        // Frontend environment variables (mapped from FE_ prefix)
        NEXT_PUBLIC_API_BASE_URL: FE_NEXT_PUBLIC_API_BASE_URL,
        NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID: FE_NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID,
        NEXT_PUBLIC_APP_URL: FE_NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_APP_NAME: FE_NEXT_PUBLIC_APP_NAME,
        NEXT_PUBLIC_ENABLE_AUTOMATION: FE_NEXT_PUBLIC_ENABLE_AUTOMATION,
    };
}

module.exports = {
    getConfig,
    processEnvironment
};