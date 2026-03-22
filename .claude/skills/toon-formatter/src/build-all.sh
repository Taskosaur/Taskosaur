#!/bin/bash
# Build TOON binaries for all supported platforms
# Requires: Zig 0.13+ installed (brew install zig)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building TOON binaries for all platforms..."

# Target configurations: zig target -> output name
declare -A TARGETS=(
    ["aarch64-macos"]="toon-darwin-arm64"
    ["x86_64-macos"]="toon-darwin-x64"
    ["x86_64-linux"]="toon-linux-x64"
    ["aarch64-linux"]="toon-linux-arm64"
)

mkdir -p bin

for target in "${!TARGETS[@]}"; do
    output="${TARGETS[$target]}"
    echo "  Building $output ($target)..."

    zig build -Dtarget="$target" -Doptimize=ReleaseFast

    mv zig-out/bin/toon "bin/$output"
    chmod +x "bin/$output"

    # Show size
    size=$(ls -lh "bin/$output" | awk '{print $5}')
    echo "    -> bin/$output ($size)"
done

echo ""
echo "All binaries built successfully:"
ls -lh bin/

echo ""
echo "To test locally:"
echo "  ./bin/toon-darwin-arm64 check test-fixtures/sample.json"
