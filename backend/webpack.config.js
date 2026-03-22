const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Custom webpack plugin to copy Swagger dependencies to dist/node_modules
 * This ensures @nestjs/swagger can find required packages at runtime
 */
class SwaggerDependenciesPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('SwaggerDependenciesPlugin', async (compilation, callback) => {
      try {
        const backendDir = compiler.context;
        const distDir = path.resolve(backendDir, 'dist');

        // Helper function to ensure directory exists
        const ensureDir = (dir) => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        };

        // Helper function to copy directory recursively
        const copyDir = (src, dest) => {
          ensureDir(dest);
          const entries = fs.readdirSync(src, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        // Copy swagger-ui-dist
        try {
          const swaggerUiSourcePath = require.resolve('swagger-ui-dist');
          const swaggerUiSourceDir = path.dirname(swaggerUiSourcePath);
          const swaggerUiDestDir = path.resolve(distDir, 'node_modules/swagger-ui-dist');

          console.log('[SwaggerDependenciesPlugin] Copying swagger-ui-dist...');
          copyDir(swaggerUiSourceDir, swaggerUiDestDir);
          console.log('[SwaggerDependenciesPlugin] swagger-ui-dist copied');
        } catch (error) {
          console.warn('[SwaggerDependenciesPlugin] Warning: Could not copy swagger-ui-dist:', error.message);
        }

        // Copy @nestjs/swagger
        try {
          const nestSwaggerPath = require.resolve('@nestjs/swagger');
          const nestSwaggerSourceDir = path.resolve(path.dirname(nestSwaggerPath), '..');
          const nestSwaggerDestDir = path.resolve(distDir, 'node_modules/@nestjs/swagger');

          console.log('[SwaggerDependenciesPlugin] Copying @nestjs/swagger...');
          copyDir(nestSwaggerSourceDir, nestSwaggerDestDir);
          console.log('[SwaggerDependenciesPlugin] @nestjs/swagger copied');
        } catch (error) {
          console.warn('[SwaggerDependenciesPlugin] Warning: Could not copy @nestjs/swagger:', error.message);
        }

        callback();
      } catch (error) {
        console.error('[SwaggerDependenciesPlugin] Error:', error);
        callback(error);
      }
    });
  }
}

/**
 * Custom webpack plugin to handle package.json sync, dependency installation, and Prisma client copy
 */
class PackageAndDependenciesPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('PackageAndDependenciesPlugin', async (compilation, callback) => {
      try {
        const backendDir = compiler.context;
        const distDir = path.resolve(backendDir, 'dist');
        const packageJsonPath = path.resolve(backendDir, 'package.json');
        const packageDistJsonPath = path.resolve(backendDir, 'package.dist.json');
        const distPackageJsonPath = path.resolve(distDir, 'package.json');

        console.log('\n[PackageAndDependenciesPlugin] Starting post-build tasks...');

        // Helper function to ensure directory exists
        const ensureDir = (dir) => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        };

        // Helper function to copy directory recursively
        const copyDir = (src, dest) => {
          ensureDir(dest);
          const entries = fs.readdirSync(src, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        // Step 1: Read package.json and package.dist.json
        console.log('[PackageAndDependenciesPlugin] Reading package.json files...');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        let packageDistJson = JSON.parse(fs.readFileSync(packageDistJsonPath, 'utf8'));

        // Step 1.5: Sync package.dist.json with package.json (update source file)
        console.log('[PackageAndDependenciesPlugin] Syncing package.dist.json with package.json...');
        let needsUpdate = false;
        const updatedPackageDistJson = { ...packageDistJson };

        for (const key in updatedPackageDistJson) {
          if (!['scripts', 'name', 'main'].includes(key) && packageJson.hasOwnProperty(key)) {
            if (JSON.stringify(updatedPackageDistJson[key]) !== JSON.stringify(packageJson[key])) {
              updatedPackageDistJson[key] = packageJson[key];
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          console.log('[PackageAndDependenciesPlugin] Updating package.dist.json with new values from package.json...');
          fs.writeFileSync(packageDistJsonPath, JSON.stringify(updatedPackageDistJson, null, 2) + '\n');
          packageDistJson = updatedPackageDistJson;
          console.log('[PackageAndDependenciesPlugin] package.dist.json updated successfully');
        } else {
          console.log('[PackageAndDependenciesPlugin] package.dist.json is already in sync');
        }

        // Step 2: Generate build number
        console.log('[PackageAndDependenciesPlugin] Generating build number...');
        let buildNumber;

        if (process.env.BUILD_NUMBER) {
          buildNumber = process.env.BUILD_NUMBER;
          console.log(`[PackageAndDependenciesPlugin] Using BUILD_NUMBER from environment: ${buildNumber}`);
        } else {
          try {
            buildNumber = execSync('git rev-parse --short HEAD', {
              cwd: backendDir,
              encoding: 'utf8',
              stdio: 'pipe',
            }).trim();
            console.log(`[PackageAndDependenciesPlugin] Using git commit hash as build number: ${buildNumber}`);
          } catch (error) {
            const now = new Date();
            buildNumber = now.getFullYear().toString() +
              (now.getMonth() + 1).toString().padStart(2, '0') +
              now.getDate().toString().padStart(2, '0') +
              now.getHours().toString().padStart(2, '0') +
              now.getMinutes().toString().padStart(2, '0') +
              now.getSeconds().toString().padStart(2, '0');
            console.log(`[PackageAndDependenciesPlugin] Git not available, using timestamp as build number: ${buildNumber}`);
          }
        }

        // Step 3: Create dist package.json with values from package.json
        console.log('[PackageAndDependenciesPlugin] Creating dist package.json with synced values...');
        const distPackageJson = { ...packageDistJson };

        for (const key in distPackageJson) {
          if (!['scripts', 'name', 'main'].includes(key) && packageJson.hasOwnProperty(key)) {
            distPackageJson[key] = packageJson[key];
          }
        }

        // Append build number to version
        if (distPackageJson.version) {
          const baseVersion = distPackageJson.version.split('-build-')[0];
          distPackageJson.version = `${baseVersion}-build-${buildNumber}`;
          console.log(`[PackageAndDependenciesPlugin] Dist version: ${distPackageJson.version}`);
        }

        // Step 4: Copy Prisma schema and migrations BEFORE npm install
        // (npm install runs postinstall which needs the schema)
        console.log('[PackageAndDependenciesPlugin] Copying Prisma schema and migrations...');
        const prismaSchemaDir = path.resolve(backendDir, 'prisma');
        const prismaSchemaDestDir = path.resolve(distDir, 'prisma');

        if (fs.existsSync(prismaSchemaDir)) {
          copyDir(prismaSchemaDir, prismaSchemaDestDir);
          console.log('[PackageAndDependenciesPlugin] Copied prisma directory (schema and migrations)');
        } else {
          console.warn('[PackageAndDependenciesPlugin] Warning: prisma directory not found, skipping...');
        }

        // Step 5: Write package.json to dist directory
        console.log('[PackageAndDependenciesPlugin] Writing package.json to dist directory...');
        fs.writeFileSync(distPackageJsonPath, JSON.stringify(distPackageJson, null, 2) + '\n');

        // Step 6: Run npm install in dist directory (skip postinstall to avoid prisma generate error)
        console.log('[PackageAndDependenciesPlugin] Running npm install in dist directory...');
        console.log('[PackageAndDependenciesPlugin] This may take a few moments...');
        execSync('npm install --production --no-audit --no-fund --ignore-scripts', {
          cwd: distDir,
          stdio: 'inherit',
        });
        console.log('[PackageAndDependenciesPlugin] Dependencies installed successfully');

        // Step 7: Copy Prisma client files
        console.log('[PackageAndDependenciesPlugin] Copying Prisma client files...');

        // Try backend node_modules first, then root node_modules (for monorepo)
        const prismaSourceDirBackend = path.resolve(backendDir, 'node_modules/.prisma/client');
        const prismaSourceDirRoot = path.resolve(backendDir, '../node_modules/.prisma/client');
        const prismaSourceDir = fs.existsSync(prismaSourceDirBackend) ? prismaSourceDirBackend : prismaSourceDirRoot;
        const prismaDestDir = path.resolve(distDir, 'node_modules/.prisma/client');

        const prismaClientSourceDirBackend = path.resolve(backendDir, 'node_modules/@prisma/client');
        const prismaClientSourceDirRoot = path.resolve(backendDir, '../node_modules/@prisma/client');
        const prismaClientSourceDir = fs.existsSync(prismaClientSourceDirBackend) ? prismaClientSourceDirBackend : prismaClientSourceDirRoot;
        const prismaClientDestDir = path.resolve(distDir, 'node_modules/@prisma/client');

        if (fs.existsSync(prismaSourceDir)) {
          copyDir(prismaSourceDir, prismaDestDir);
          console.log('[PackageAndDependenciesPlugin] Copied .prisma/client');
        } else {
          console.warn('[PackageAndDependenciesPlugin] Warning: .prisma/client not found, skipping...');
        }

        if (fs.existsSync(prismaClientSourceDir)) {
          copyDir(prismaClientSourceDir, prismaClientDestDir);
          console.log('[PackageAndDependenciesPlugin] Copied @prisma/client');
        } else {
          console.warn('[PackageAndDependenciesPlugin] Warning: @prisma/client not found, skipping...');
        }

        // Step 7.5: Copy bcrypt native bindings
        console.log('[PackageAndDependenciesPlugin] Copying bcrypt native bindings...');

        // Try backend node_modules first, then root node_modules (for monorepo)
        const bcryptSourceDirBackend = path.resolve(backendDir, 'node_modules/bcrypt/lib/binding');
        const bcryptSourceDirRoot = path.resolve(backendDir, '../node_modules/bcrypt/lib/binding');
        const bcryptSourceDir = fs.existsSync(bcryptSourceDirBackend) ? bcryptSourceDirBackend : bcryptSourceDirRoot;
        const bcryptDestDir = path.resolve(distDir, 'node_modules/bcrypt/lib/binding');

        if (fs.existsSync(bcryptSourceDir)) {
          copyDir(bcryptSourceDir, bcryptDestDir);
          console.log('[PackageAndDependenciesPlugin] Copied bcrypt native bindings');
        } else {
          console.warn('[PackageAndDependenciesPlugin] Warning: bcrypt native bindings not found, skipping...');
        }

        // Step 8: Copy .env file if it exists
        const backendEnvPath = path.resolve(backendDir, '.env');
        const envDestPath = path.resolve(distDir, '.env');

        if (fs.existsSync(backendEnvPath)) {
          fs.copyFileSync(backendEnvPath, envDestPath);
          console.log('[PackageAndDependenciesPlugin] Copied .env file');
        } else {
          console.log('[PackageAndDependenciesPlugin] No .env file found, skipping...');
        }

        console.log('[PackageAndDependenciesPlugin] All post-build tasks completed successfully!\n');
        callback();
      } catch (error) {
        console.error('[PackageAndDependenciesPlugin] Error during post-build tasks:', error);
        callback(error);
      }
    });
  }
}

module.exports = function (options, webpack) {
  const lazyImports = [
    '@nestjs/microservices',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    'cache-manager',
    'class-validator',
    'class-transformer',
    '@mikro-orm/core',
    '@nestjs/mongoose',
    '@nestjs/sequelize',
    '@nestjs/typeorm',
    '@nestjs/sequelize/dist/common/sequelize.utils',
    '@nestjs/typeorm/dist/common/typeorm.utils',
  ];

  // Check if BUILD_DIST environment variable is set
  const isBuildDist = process.env.BUILD_DIST === 'true';

  // Base plugins array
  const plugins = [
    ...options.plugins,
    new webpack.IgnorePlugin({
      checkResource(resource) {
        if (!lazyImports.includes(resource)) {
          return false;
        }
        try {
          require.resolve(resource, {
            paths: [process.cwd()],
          });
        } catch (err) {
          return true;
        }
        return false;
      },
    }),
    // Always copy Swagger dependencies for Swagger UI to work
    new SwaggerDependenciesPlugin(),
  ];

  // Only add PackageAndDependenciesPlugin when BUILD_DIST is true
  if (isBuildDist) {
    plugins.push(new PackageAndDependenciesPlugin());
  }

  return {
    ...options,
    entry: ['./src/main'],
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve?.alias,
        // Force webpack to use rxjs from node_modules (either backend or root)
        'rxjs': path.resolve(__dirname, fs.existsSync(path.resolve(__dirname, 'node_modules/rxjs')) ? 'node_modules/rxjs' : '../node_modules/rxjs'),
      },
    },
    externals: [
      // Exclude native modules from webpack bundle
      'bcrypt',
      '@prisma/client',
      'prisma',
      'class-validator',
      'class-transformer',
      'cache-manager',

      // Exclude Swagger modules so they can resolve paths at runtime
      '@nestjs/swagger',
      'swagger-ui-dist',
      'swagger-ui-express',

      // Exclude optional peer dependencies
      /^@?aws-sdk/,
    ],
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
      filename: 'main.js',
    },
    optimization: {
      minimize: false,
      splitChunks: false,
      runtimeChunk: false,
    },
    module: {
      ...options.module,
      rules: [
        ...options.module.rules,
        {
          test: /\.d\.ts$/,
          use: 'ignore-loader',
        },
        {
          test: /\.js\.map$/,
          use: 'ignore-loader',
        },
      ],
    },
    plugins,
  };
};
