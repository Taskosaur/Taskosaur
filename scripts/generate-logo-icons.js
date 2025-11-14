#!/usr/bin/env node

/**
 * Generate Logo Icons Script
 *
 * Generates various favicon and icon formats from an SVG source file.
 *
 * Usage:
 *   npm run generate:logo:icons
 *   npm run generate:logo:icons -- --source=path/to/logo.svg
 *   npm run generate:logo:icons -- --source=path/to/logo.svg --output=path/to/output
 *
 * Options:
 *   --source   Source SVG file path (default: assets/logo/taskosaur-logo.svg)
 *   --output   Output directory (default: frontend/public)
 */

const fs = require('fs');
const path = require('path');

// Parse command-line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_SOURCE = path.join(ROOT_DIR, 'assets/logo/taskosaur-logo.svg');
const DEFAULT_OUTPUT = path.join(ROOT_DIR, 'frontend/public');

const sourcePath = args.source
  ? path.isAbsolute(args.source)
    ? args.source
    : path.join(ROOT_DIR, args.source)
  : DEFAULT_SOURCE;

const outputDir = args.output
  ? path.isAbsolute(args.output)
    ? args.output
    : path.join(ROOT_DIR, args.output)
  : DEFAULT_OUTPUT;

// Icon sizes to generate
const ICON_SIZES = [
  { name: 'favicon-16x16.png', size: 16, description: 'Favicon 16x16' },
  { name: 'favicon-32x32.png', size: 32, description: 'Favicon 32x32' },
  { name: 'apple-touch-icon.png', size: 180, description: 'Apple Touch Icon' },
  { name: 'android-chrome-192x192.png', size: 192, description: 'Android Chrome 192x192' },
  { name: 'android-chrome-512x512.png', size: 512, description: 'Android Chrome 512x512' },
  { name: 'taskosaur-logo.png', size: 512, description: 'Taskosaur Logo' },
];

/**
 * Validate that the source file exists and is an SVG
 */
function validateSource() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Error: Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== '.svg') {
    console.error(`❌ Error: Source file must be an SVG file, got: ${ext}`);
    process.exit(1);
  }

  console.log(`✓ Source file: ${path.relative(ROOT_DIR, sourcePath)}`);
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✓ Created output directory: ${path.relative(ROOT_DIR, outputDir)}`);
  } else {
    console.log(`✓ Output directory: ${path.relative(ROOT_DIR, outputDir)}`);
  }
}

/**
 * Copy SVG favicon
 */
function copySvgFavicon() {
  const svgDest = path.join(outputDir, 'favicon.svg');
  fs.copyFileSync(sourcePath, svgDest);
  console.log(`✓ Generated: favicon.svg`);
}

/**
 * Generate PNG icons using sharp
 */
async function generatePngIcons() {
  // Import sharp - try root node_modules first, then frontend
  let sharp;
  const sharpPaths = [
    path.join(ROOT_DIR, 'node_modules/sharp'),
    path.join(ROOT_DIR, 'frontend/node_modules/sharp'),
  ];

  for (const sharpPath of sharpPaths) {
    try {
      sharp = require(sharpPath);
      break;
    } catch (error) {
      // Try next path
    }
  }

  if (!sharp) {
    console.error(`❌ Error: Could not load sharp library. Please run 'npm install' first.`);
    console.error(`   Searched paths:`);
    sharpPaths.forEach(p => console.error(`     - ${p}`));
    process.exit(1);
  }

  // Read the SVG file
  const svgBuffer = fs.readFileSync(sourcePath);

  // Store PNG buffers for ICO generation
  const pngBuffers = [];

  // Generate each size
  for (const icon of ICON_SIZES) {
    try {
      const pngBuffer = await sharp(svgBuffer)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toBuffer();

      // Write PNG file
      fs.writeFileSync(path.join(outputDir, icon.name), pngBuffer);

      // Store 16x16 and 32x32 buffers for ICO generation
      if (icon.size === 16 || icon.size === 32) {
        pngBuffers.push(pngBuffer);
      }

      console.log(`✓ Generated: ${icon.name} (${icon.description})`);
    } catch (error) {
      console.error(`❌ Error generating ${icon.name}: ${error.message}`);
      process.exit(1);
    }
  }

  return pngBuffers;
}

/**
 * Generate favicon.ico using to-ico
 */
async function generateFaviconIco(pngBuffers) {
  try {
    const toIco = require('to-ico');
    const icoBuffer = await toIco(pngBuffers);
    const icoPath = path.join(outputDir, 'favicon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`✓ Generated: favicon.ico (Multi-resolution ICO)`);
  } catch (error) {
    console.error(`❌ Error generating favicon.ico: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate web app manifest
 */
function generateManifest() {
  const manifest = {
    name: 'TaskosaurAny',
    short_name: 'Taskosaur',
    description: 'Intelligent task automation platform with AI-powered chat interface',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    orientation: 'portrait'
  };

  const manifestPath = path.join(outputDir, 'site.webmanifest');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Generated: site.webmanifest`);
}

/**
 * Generate browserconfig.xml for Windows tiles
 */
function generateBrowserconfig() {
  const browserconfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/android-chrome-192x192.png"/>
      <TileColor>#ffffff</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;

  const browserconfigPath = path.join(outputDir, 'browserconfig.xml');
  fs.writeFileSync(browserconfigPath, browserconfig);
  console.log(`✓ Generated: browserconfig.xml`);
}

/**
 * Print usage instructions
 */
function printUsageInstructions() {
  console.log('\n📝 Next Steps:');
  console.log('   The icons have been generated in frontend/public/');
  console.log('   Make sure to add the following to your _document.tsx <Head> component:');
  console.log('');
  console.log('   <link rel="icon" href="/favicon.ico" sizes="any" />');
  console.log('   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  console.log('   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />');
  console.log('   <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />');
  console.log('   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
  console.log('   <link rel="manifest" href="/site.webmanifest" />');
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🎨 Generating Logo Icons\n');
  console.log('═══════════════════════════════════════\n');

  try {
    validateSource();
    ensureOutputDir();

    console.log('\n📦 Generating icons...\n');

    copySvgFavicon();
    const pngBuffers = await generatePngIcons();
    await generateFaviconIco(pngBuffers);
    generateManifest();
    generateBrowserconfig();

    console.log('\n═══════════════════════════════════════');
    console.log('✅ All icons generated successfully!\n');

    printUsageInstructions();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
