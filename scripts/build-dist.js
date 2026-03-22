#!/usr/bin/env node

/**
 * Build distribution script for Taskosaur platform
 * Cross-platform implementation of build:dist command
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, options = {}) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Error running command: ${command}`);
    process.exit(1);
  }
}

function copyRecursive(src, dest) {
  const srcPath = path.resolve(src);
  const destPath = path.resolve(dest);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️  Source path does not exist: ${srcPath}`);
    return;
  }

  console.log(`Copying ${srcPath} -> ${destPath}`);

  try {
    // Ensure parent directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy with recursive and preserve timestamps (equivalent to cp -a)
    fs.cpSync(srcPath, destPath, {
      recursive: true,
      preserveTimestamps: true,
      force: true,
    });

    console.log(`✅ Successfully copied ${src} to ${dest}`);
  } catch (error) {
    console.error(`❌ Error copying ${src} to ${dest}:`, error.message);
    process.exit(1);
  }
}

console.log('\n🏗️  Building distribution for Taskosaur platform...\n');

// Step 1: Clean dist directory
console.log('🧹 Cleaning dist directory...');
runCommand('shx rm -rf dist');

// Step 2: Build workspaces
console.log('\n📦 Building workspaces...');
runCommand('npm run build:dist --workspaces --if-present');

// Step 3: Copy backend dist to dist
console.log('\n📂 Copying backend distribution...');
copyRecursive('backend/dist', 'dist');

// Step 4: Copy frontend out to dist/public
console.log('\n📂 Copying frontend distribution...');
copyRecursive('frontend/out', 'dist/public');

// Step 5: Fix absolute symlinks in dist/node_modules/.bin/
// npm and Bun create absolute symlinks when installing in backend/dist/.
// After copying to dist/ the absolute paths no longer match the production
// container path. We rewrite them as relative paths, computing the offset
// from the SOURCE .bin/ directory so the same relative path is valid in
// both the builder (dist/) and the production container (/app/taskosaur/).
console.log('\n🔗 Fixing symlinks in dist/node_modules/.bin/...');
const srcBinDir = path.resolve('backend/dist', 'node_modules', '.bin');
const destBinDir = path.resolve('dist', 'node_modules', '.bin');
if (fs.existsSync(destBinDir)) {
  let fixed = 0;
  for (const entry of fs.readdirSync(destBinDir)) {
    const entryPath = path.join(destBinDir, entry);
    try {
      if (fs.lstatSync(entryPath).isSymbolicLink()) {
        const target = fs.readlinkSync(entryPath);
        if (path.isAbsolute(target)) {
          // Relative offset from source .bin/ → target is the correct offset
          // regardless of where the directory ends up being placed.
          const relTarget = path.relative(srcBinDir, target);
          fs.unlinkSync(entryPath);
          fs.symlinkSync(relTarget, entryPath);
          fixed++;
        }
      }
    } catch (_) { /* skip unreadable entries */ }
  }
  console.log(`✅ Fixed ${fixed} absolute symlink(s)`);
}

console.log('\n✅ Distribution build complete!\n');
