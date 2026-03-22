# Installing and Using the Zig TOON Enforcer

## Quick Start (Prebuilt Binaries)

Prebuilt binaries are included in `bin/` for supported platforms:

```
bin/
├── toon-darwin-arm64    # macOS Apple Silicon
├── toon-darwin-x64      # macOS Intel
├── toon-linux-x64       # Linux x64
└── toon-linux-arm64     # Linux ARM
```

The `claude-starter init` command automatically symlinks the correct binary for your platform.

```bash
# Test the binary directly
./bin/toon-darwin-arm64 --help
```

## Building from Source

If you need to rebuild or your platform isn't supported:

### Prerequisites

Install Zig (version 0.13.0 or later):

**macOS:**
```bash
brew install zig
```

**Linux:**
```bash
# Using snap
sudo snap install zig --classic --beta

# Or download from https://ziglang.org/download/
wget https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz
tar xf zig-linux-x86_64-0.13.0.tar.xz
sudo mv zig-linux-x86_64-0.13.0 /usr/local/zig
export PATH=$PATH:/usr/local/zig
```

**Windows:**
```powershell
# Using Scoop
scoop install zig

# Or download from https://ziglang.org/download/
```

### Build for Current Platform

```bash
cd .claude/skills/toon-formatter

# Build optimized binary
zig build -Doptimize=ReleaseFast

# Binary is at zig-out/bin/toon
./zig-out/bin/toon --help
```

### Build for All Platforms (Maintainers)

```bash
# Build binaries for all supported platforms
./build-all.sh

# Output in bin/ directory:
#   toon-darwin-arm64
#   toon-darwin-x64
#   toon-linux-x64
#   toon-linux-arm64
```

### Run Tests

```bash
zig build test
```

## Usage

### 1. Check if JSON should use TOON

```bash
$ echo '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]' > test.json
$ ./zig-out/bin/toon check test.json
✗ JSON format recommended (keep as-is)
# Exit code 1 because <5 items
```

```bash
$ cat large.json
[
  {"id":1,"name":"Alice","role":"admin"},
  {"id":2,"name":"Bob","role":"user"},
  {"id":3,"name":"Carol","role":"user"},
  {"id":4,"name":"Dan","role":"user"},
  {"id":5,"name":"Eve","role":"admin"}
]

$ ./zig-out/bin/toon check large.json
✓ TOON format recommended (≥5 items, ≥60% uniformity)
# Exit code 0
```

### 2. Convert JSON to TOON

```bash
$ ./zig-out/bin/toon encode large.json
[5]{id,name,role}:
  1,Alice,admin
  2,Bob,user
  3,Carol,user
  4,Dan,user
  5,Eve,admin
```

### 3. Convert TOON back to JSON

```bash
$ ./zig-out/bin/toon encode large.json > output.toon
$ ./zig-out/bin/toon decode output.toon
[{"id":"1","name":"Alice","role":"admin"},{"id":"2","name":"Bob","role":"user"}, ...]
```

### 4. Enforce TOON in Documentation

```bash
# Scan all .claude/docs/toon/*.md files for JSON that should use TOON
$ ./enforce-toon.sh

Enforcing TOON format in documentation...

Checking: ../../docs/toon/examples/api-endpoints.md
  ⚠ Line 42: JSON array should use TOON format
    Suggested conversion:
    [15]{method,path,auth,rateLimit}:
      GET,/api/users,required,100/min
      ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Checked 10 files
⚠ 3 file(s) have JSON that should use TOON
```

## Integration with Claude Code

After building, you can use the Zig binary in your workflows:

### Add to PATH (Optional)

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$PATH:/Users/zach/Documents/claude-starter/.claude/skills/toon-formatter/zig-out/bin"

# Now you can run from anywhere:
toon check data.json
toon encode data.json
```

### Use in Commands

Create `.claude/commands/check-toon.md`:

```markdown
# Check TOON

Check if documentation uses appropriate TOON format.

Usage: /check-toon

Execute the following workflow:

1. **Run TOON Enforcement**
   ```bash
   .claude/skills/toon-formatter/enforce-toon.sh
   ```
```

### Use in Hooks

Create `.claude/hooks/toon_check.sh`:

```bash
#!/usr/bin/env bash
# Hook that runs after editing TOON docs

if [[ "$CLAUDE_FILE_PATH" == *".claude/docs/toon"* ]]; then
    .claude/skills/toon-formatter/enforce-toon.sh
fi
```

## Performance

The Zig implementation is **~20x faster** than TypeScript alternatives:

```bash
# Benchmark with 1000-item array
$ hyperfine \
    './zig-out/bin/toon encode large.json' \
    'node typescript-encoder.js large.json'

Benchmark 1: ./zig-out/bin/toon encode large.json
  Time (mean ± σ):       2.1 ms ±   0.3 ms    [User: 1.2 ms, System: 0.5 ms]
  Range (min … max):     1.8 ms …   3.4 ms    500 runs

Benchmark 2: node typescript-encoder.js large.json
  Time (mean ± σ):      47.3 ms ±   2.1 ms    [User: 42.1 ms, System: 8.2 ms]
  Range (min … max):    44.2 ms …  54.8 ms    100 runs

Summary
  './zig-out/bin/toon encode large.json' ran
   22.52 ± 3.12 times faster than 'node typescript-encoder.js large.json'
```

## Next Steps

1. **Build the binary**: `zig build -Doptimize=ReleaseFast`
2. **Test it**: `./zig-out/bin/toon check test.json`
3. **Run enforcement**: `./enforce-toon.sh`
4. **Integrate with your workflow**: Add to commands/hooks

See [README_ZIG.md](./README_ZIG.md) for complete documentation.
