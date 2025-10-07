const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Generate a random 64-character alphanumeric string for JWT secrets
 * Uses base64 character set but only alphanumeric (0-9, a-z, A-Z) - no symbols
 */
function generateJwtSecret() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    
    // Generate 64 characters using alphanumeric characters only
    for (let i = 0; i < 64; i++) {
        const randomIndex = crypto.randomBytes(1)[0] % chars.length;
        result += chars[randomIndex];
    }
    
    return result;
}

/**
 * Ask user a question and return the answer
 */
function askQuestion(rl, question, defaultValue = '') {
    return new Promise((resolve) => {
        const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
        rl.question(prompt, (answer) => {
            const trimmedAnswer = answer.trim();
            // If user enters blank and there's a default value, use it
            // If user enters blank and no default value, return empty string
            resolve(trimmedAnswer || defaultValue);
        });
    });
}

/**
 * Parse existing .env file and categorize variables by prefix
 */
function parseExistingEnvFile(filePath) {
    try {
        const envContent = fs.readFileSync(filePath, 'utf8');
        const globalConfig = {};
        const backendConfig = {};
        const frontendConfig = {};
        
        // Parse the existing .env file for all environment variables
        const lines = envContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip comments and empty lines
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('####')) {
                continue;
            }
            
            // Split on first '=' to handle values that contain '='
            const equalIndex = trimmedLine.indexOf('=');
            if (equalIndex === -1) continue;
            
            const key = trimmedLine.substring(0, equalIndex);
            const value = trimmedLine.substring(equalIndex + 1);
            
            // Categorize variables by prefix
            if (key.startsWith('BE_')) {
                backendConfig[key] = value;
            } else if (key.startsWith('FE_')) {
                frontendConfig[key] = value;
            } else {
                // All other variables are global
                globalConfig[key] = value;
            }
        }
        
        return {
            global: globalConfig,
            backend: backendConfig,
            frontend: frontendConfig
        };
    } catch (error) {
        return {
            global: {},
            backend: {},
            frontend: {}
        };
    }
}

/**
 * Generate .env file content with all variables properly categorized
 */
function generateEnvContent(globalVars, backendVars, frontendVars) {
    const content = [];
    
    // Global variables section
    if (Object.keys(globalVars).length > 0) {
        content.push('# Global/Proxy Configuration');
        Object.entries(globalVars).forEach(([key, value]) => {
            content.push(`${key}=${value}`);
        });
        content.push('');
    }
    
    // Backend variables section
    if (Object.keys(backendVars).length > 0) {
        content.push('#### Backend Configuration >>>>>');
        Object.entries(backendVars).forEach(([key, value]) => {
            content.push(`${key}=${value}`);
        });
        content.push('#### Backend Configuration <<<<<');
        content.push('');
    }
    
    // Frontend variables section
    if (Object.keys(frontendVars).length > 0) {
        content.push('#### Frontend Configuration >>>>>');
        Object.entries(frontendVars).forEach(([key, value]) => {
            content.push(`${key}=${value}`);
        });
        content.push('#### Frontend Configuration <<<<<');
        content.push('');
    }
    
    return content.join('\n');
}

/**
 * Create simplified .env file with all configurations in one place
 */
async function createSimpleEnvFile() {
    const rootEnvPath = path.join(process.cwd(), '.env');
    
    // Check if .env already exists
    if (fs.existsSync(rootEnvPath)) {
        console.log('ℹ️  .env file already exists, skipping environment setup...');
        return;
    }
    
    const rl = createReadlineInterface();
    
    try {
        console.log('\n🌐 Setting up environment configuration...\n');
        
        const config = {};
        
        // Global/Proxy Configuration
        console.log('🌍 Global Application Settings:');
        config.APP_HOST = await askQuestion(rl, 'Global App Host', '127.0.0.1');
        config.APP_PORT = await askQuestion(rl, 'Global App Port', '9100');
        
        // Backend Configuration
        console.log('\n🔧 Backend Configuration:');
        const useBeUnixSocket = await askQuestion(rl, 'Use Backend Unix Socket? (1 for yes, 0 for no)', '1');
        config.BE_UNIX_SOCKET = useBeUnixSocket;
        
        if (useBeUnixSocket === '0') {
            config.BE_HOST = await askQuestion(rl, 'Backend Host', '127.0.0.1');
            config.BE_PORT = await askQuestion(rl, 'Backend Port', '9102');
        }
        
        // Frontend Configuration  
        console.log('\n🖥️  Frontend Configuration:');
        const useFeUnixSocket = await askQuestion(rl, 'Use Frontend Unix Socket? (1 for yes, 0 for no)', '1');
        config.FE_UNIX_SOCKET = useFeUnixSocket;
        
        if (useFeUnixSocket === '0') {
            config.FE_HOST = await askQuestion(rl, 'Frontend Host', '127.0.0.1');
            config.FE_PORT = await askQuestion(rl, 'Frontend Port', '9101');
        }
        
        // Database Configuration
        console.log('\n📊 Database Configuration:');
        const dbHost = await askQuestion(rl, 'Database Host', 'localhost');
        const dbPort = await askQuestion(rl, 'Database Port', '5432');
        const dbUsername = await askQuestion(rl, 'Database Username', 'taskosaur');
        const dbPassword = await askQuestion(rl, 'Database Password', 'taskosaur');
        const dbName = await askQuestion(rl, 'Database Name', 'taskosaur');
        config.BE_DATABASE_URL = `"postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}"`;
        
        // Authentication
        console.log('\n🔐 Authentication:');
        const defaultJwtSecret = generateJwtSecret();
        const defaultJwtRefreshSecret = generateJwtSecret();
        config.BE_JWT_SECRET = `"${await askQuestion(rl, 'JWT Secret Key', defaultJwtSecret)}"`;
        config.BE_JWT_REFRESH_SECRET = `"${await askQuestion(rl, 'JWT Refresh Secret Key', defaultJwtRefreshSecret)}"`;
        config.BE_JWT_EXPIRES_IN = `"${await askQuestion(rl, 'JWT Expiration Time', '15m')}"`;
        config.BE_JWT_REFRESH_EXPIRES_IN = `"${await askQuestion(rl, 'JWT Refresh Expiration Time', '7d')}"`;
        
        // Email Configuration
        console.log('\n🔴 Email Configuration:');
        config.BE_ENCRYPTION_KEY = await askQuestion(rl, 'Email Encryption Key', '851244b23bd99bc32b28ab104da1a6ae4e338a872bd9e98a4ba89097796152b1405355162a1cf568e14689ba51dd55377d36041c5f63bb4bfecf7e1199d37cb0');
        config.BE_EMAIL_DOMAIN = await askQuestion(rl, 'Email Domain', 'taskosaur.com');

        // Redis Configuration
        console.log('\n🔴 Redis Configuration:');
        config.BE_REDIS_HOST = await askQuestion(rl, 'Redis Host', 'localhost');
        config.BE_REDIS_PORT = await askQuestion(rl, 'Redis Port', '6379');
        config.BE_REDIS_PASSWORD = await askQuestion(rl, 'Redis Password (leave empty if none)', '');
        
        // Email Configuration
        console.log('\n📧 Email Configuration:');
        config.BE_SMTP_HOST = await askQuestion(rl, 'SMTP Host', 'smtp.example.com');
        config.BE_SMTP_PORT = await askQuestion(rl, 'SMTP Port', '587');
        config.BE_SMTP_USER = await askQuestion(rl, 'SMTP User (email address)', 'your-email@example.com');
        config.BE_SMTP_PASS = await askQuestion(rl, 'SMTP Password (app password)', 'your-app-password');
        config.BE_SMTP_FROM = await askQuestion(rl, 'From Email Address', 'noreply@example.com');
        // Bucket Configuration
        console.log('\n📧 Bucket Configuration:');
        config.BE_AWS_ACCESS_KEY_ID = await askQuestion(rl, 'AWS Access Key', 'your-access-key');
        config.BE_AWS_SECRET_ACCESS_KEY = await askQuestion(rl, 'AWS Secret Key', 'your-secret-key');
        config.BE_AWS_REGION = await askQuestion(rl, 'AWS Region', 'ap-south-1');
        config.BE_AWS_BUCKET_NAME = await askQuestion(rl, 'AWS Bucket Name', 'your-bucket-name');
    
        
        // Frontend URL (auto-configured based on APP_HOST and APP_PORT)
        config.BE_FRONTEND_URL = `http://${config.APP_HOST}:${config.APP_PORT}`;
        
        // File Upload
        console.log('\n📁 File Upload Configuration:');
        config.BE_UPLOAD_DEST = `"${await askQuestion(rl, 'Upload Destination Directory', './uploads')}"`;
        config.BE_MAX_FILE_SIZE = await askQuestion(rl, 'Maximum File Size (bytes)', '10485760');
        
        // Queue Configuration
        console.log('\n⚙️ Queue Configuration:');
        config.BE_MAX_CONCURRENT_JOBS = await askQuestion(rl, 'Maximum Concurrent Jobs', '5');
        config.BE_JOB_RETRY_ATTEMPTS = await askQuestion(rl, 'Job Retry Attempts', '3');
        
        // Frontend Environment Variables
        config.FE_NEXT_PUBLIC_API_BASE_URL = await askQuestion(rl, 'Frontend API Base URL', '/api');
        config.FE_NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID = await askQuestion(rl, 'Default Organization ID', 'your-default-organization-id-here');
        
        // Categorize variables
        const globalVars = {
            APP_HOST: config.APP_HOST,
            APP_PORT: config.APP_PORT
        };
        
        const backendVars = {};
        const frontendVars = {};
        
        // Sort variables by prefix
        Object.entries(config).forEach(([key, value]) => {
            if (key.startsWith('BE_')) {
                backendVars[key] = value;
            } else if (key.startsWith('FE_')) {
                frontendVars[key] = value;
            } else if (!key.startsWith('APP_')) {
                globalVars[key] = value;
            }
        });
        
        // Generate and write .env file
        const envContent = generateEnvContent(globalVars, backendVars, frontendVars);
        fs.writeFileSync(rootEnvPath, envContent);
        
        console.log('\n✅ .env file created successfully!');
        console.log(`📁 Location: ${rootEnvPath}`);
        
    } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        throw error;
    } finally {
        rl.close();
    }
}

/**
 * Update .env file with new variables while preserving existing ones
 */
function updateEnvFile(filePath, newGlobalVars = {}, newBackendVars = {}, newFrontendVars = {}) {
    const existingConfig = parseExistingEnvFile(filePath);
    
    // Merge existing with new variables
    const mergedGlobal = { ...existingConfig.global, ...newGlobalVars };
    const mergedBackend = { ...existingConfig.backend, ...newBackendVars };
    const mergedFrontend = { ...existingConfig.frontend, ...newFrontendVars };
    
    // Generate and write updated content
    const envContent = generateEnvContent(mergedGlobal, mergedBackend, mergedFrontend);
    fs.writeFileSync(filePath, envContent);
    
    return {
        global: mergedGlobal,
        backend: mergedBackend,
        frontend: mergedFrontend
    };
}

module.exports = {
    createSimpleEnvFile,
    parseExistingEnvFile,
    generateEnvContent,
    updateEnvFile
};