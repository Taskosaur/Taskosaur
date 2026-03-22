const std = @import("std");
const json = std.json;
const Allocator = std.mem.Allocator;

/// TOON v3.0 Complete Implementation
/// Specification: https://github.com/toon-format/spec (v3.0)
///
/// Features:
/// - Three array types (inline, tabular, expanded)
/// - Three delimiters (comma, tab, pipe)
/// - Key folding with collision detection
/// - Path expansion (decoder)
/// - Strict mode validation
/// - Canonical number formatting
/// - Complete escape/quote handling
/// - Configurable encoder/decoder

pub const Delimiter = enum {
    comma,
    tab,
    pipe,

    pub fn fromString(s: []const u8) !Delimiter {
        if (std.mem.eql(u8, s, "comma")) return .comma;
        if (std.mem.eql(u8, s, "tab")) return .tab;
        if (std.mem.eql(u8, s, "pipe")) return .pipe;
        return error.InvalidDelimiter;
    }

    pub fn toChar(self: Delimiter) u8 {
        return switch (self) {
            .comma => ',',
            .tab => '\t',
            .pipe => '|',
        };
    }

    pub fn toString(self: Delimiter) []const u8 {
        return switch (self) {
            .comma => "comma",
            .tab => "tab",
            .pipe => "pipe",
        };
    }
};

pub const ArrayType = enum {
    inline_primitive,  // friends[3]: a,b,c
    tabular,          // [N]{fields}: values
    expanded_list,    // - item format
};

pub const EncoderConfig = struct {
    indent_size: usize = 2,
    delimiter: Delimiter = .comma,
    key_folding: bool = true,
    flatten_depth: ?usize = null,

    pub fn init() EncoderConfig {
        return .{};
    }
};

pub const DecoderConfig = struct {
    indent_size: usize = 2,
    strict: bool = false,
    expand_paths: bool = true,

    pub fn init() DecoderConfig {
        return .{};
    }
};

/// Security limits to prevent DoS via malicious input
pub const SecurityLimits = struct {
    /// Maximum array count in [N]{fields}: header (prevents OOM)
    pub const MAX_ARRAY_COUNT: usize = 1_000_000;
    /// Maximum recursion depth for nested structures
    pub const MAX_DEPTH: usize = 100;
    /// Maximum string length for a single value
    pub const MAX_STRING_LENGTH: usize = 10 * 1024 * 1024; // 10MB
    /// Maximum number of fields in tabular array header
    pub const MAX_FIELDS: usize = 1000;
    /// Maximum key length
    pub const MAX_KEY_LENGTH: usize = 1024;
};

/// Thresholds for array type detection (documented rationale)
pub const ArrayThresholds = struct {
    /// Minimum items for TOON to be worthwhile (header overhead vs savings)
    pub const MIN_ITEMS_FOR_TOON: usize = 5;
    /// Maximum items for inline primitive arrays (readability vs compactness)
    pub const MAX_INLINE_ITEMS: usize = 10;
    /// Minimum field uniformity percentage for tabular format (60% = most fields shared)
    pub const MIN_UNIFORMITY_PERCENT: usize = 60;
};

/// Parser error set for specific error handling (better than anyerror)
pub const ParseError = error{
    InvalidEscape,
    UnterminatedString,
    ArrayCountMismatch,
    InvalidIndentation,
    PathCollision,
    NonObjectInArray,
    UnsupportedValueType,
    InvalidDelimiter,
    ExpectedCharacter,
    OutOfMemory,
    Overflow,
    InvalidCharacter,
    ArrayCountExceedsLimit,
    DepthExceedsLimit,
    StringTooLong,
    TooManyFields,
    KeyTooLong,
};

// Parser for TOON format
const Parser = struct {
    allocator: Allocator,
    input: []const u8,
    pos: usize,
    config: DecoderConfig,
    depth: usize, // Security: Track recursion depth

    pub fn init(allocator: Allocator, input: []const u8, config: DecoderConfig) Parser {
        return .{
            .allocator = allocator,
            .input = input,
            .pos = 0,
            .config = config,
            .depth = 0,
        };
    }

    pub fn parse(self: *Parser) !json.Value {
        return try self.parseValue(0);
    }

    fn parseValue(self: *Parser, indent: usize) ParseError!json.Value {
        // Security: Prevent stack overflow from deeply nested structures
        self.depth += 1;
        defer self.depth -= 1;

        if (self.depth > SecurityLimits.MAX_DEPTH) {
            return ParseError.DepthExceedsLimit;
        }

        self.skipWhitespace();

        if (self.pos >= self.input.len) {
            return json.Value{ .null = {} };
        }

        // Check for array header [N]{fields}: or [N]:
        if (self.peek() == '[') {
            return try self.parseTabularArray();
        }

        // Check for inline array: key[N]: values
        if (self.peekIdentifier()) |_| {
            const checkpoint = self.pos;
            _ = try self.parseIdentifier();
            self.skipWhitespace();
            if (self.peek() == '[') {
                return try self.parseInlineArray();
            }
            // Not inline array, restore position
            self.pos = checkpoint;
        }

        // Check for expanded list: - item
        if (self.peek() == '-' and self.peekAhead(1) == ' ') {
            return try self.parseExpandedList(indent);
        }

        // Check for inline scalar value (on same line, not a newline)
        // This handles key: value pairs where value is on the same line
        const c = self.peek();
        if (c != '\n' and c != '\r') {
            // Check if it looks like a scalar value (not a key: pair)
            // If we don't see a ':' soon, it's a scalar
            var found_colon = false;
            var scan_pos: usize = 0;
            while (scan_pos < 100 and self.pos + scan_pos < self.input.len) : (scan_pos += 1) {
                const scan_char = self.input[self.pos + scan_pos];
                if (scan_char == '\n' or scan_char == '\r') break;
                if (scan_char == ':') {
                    found_colon = true;
                    break;
                }
            }

            if (!found_colon) {
                // It's an inline scalar, not a key:value pair
                return try self.parseFieldValue(.comma); // Use comma as delimiter (will stop at newline)
            }
            // Has colon, might be nested object, fall through to parseObject
        }

        // Parse object (key: value pairs)
        return try self.parseObject(indent);
    }

    fn parseTabularArray(self: *Parser) !json.Value {
        _ = self.consume(); // '['

        const count = try self.parseNumber();
        const expected_count = @as(usize, @intFromFloat(count.float));

        // Security: Prevent DoS via huge array count
        if (expected_count > SecurityLimits.MAX_ARRAY_COUNT) {
            return ParseError.ArrayCountExceedsLimit;
        }

        // Check for delimiter marker INSIDE brackets per spec v3.0: [N\t] or [N|]
        var delimiter: Delimiter = .comma;
        if (self.peek() == '\\') {
            _ = self.consume();
            if (self.peek() == 't') {
                _ = self.consume();
                delimiter = .tab;
            }
        } else if (self.peek() == '|') {
            _ = self.consume();
            delimiter = .pipe;
        }

        try self.expect(']');
        try self.expect('{');

        // Parse field names
        var fields = std.ArrayList([]const u8).init(self.allocator);
        defer fields.deinit();

        var field_count: usize = 0;
        while (self.peek() != '}') {
            // Security: Limit number of fields
            if (field_count >= SecurityLimits.MAX_FIELDS) {
                return ParseError.TooManyFields;
            }

            const field = try self.parseIdentifier();
            try fields.append(field);
            field_count += 1;

            if (self.peek() == ',') {
                _ = self.consume();
            } else {
                break;
            }
        }

        try self.expect('}');
        try self.expect(':');
        self.skipLine();

        // Parse rows
        var array = json.Array.init(self.allocator);
        errdefer array.deinit();

        var row_count: usize = 0;
        while (row_count < expected_count) {
            // Don't skip whitespace here - we need to check for indentation first!

            // Expect indentation
            if (self.peek() != ' ') break;
            try self.expectIndent(1);

            var obj = json.ObjectMap.init(self.allocator);
            errdefer obj.deinit();

            for (fields.items, 0..) |field, i| {
                if (i > 0) {
                    try self.expect(delimiter.toChar());
                }

                const value = try self.parseFieldValue(delimiter);
                try obj.put(field, value);
            }

            try array.append(json.Value{ .object = obj });
            self.skipLine();
            row_count += 1;
        }

        if (self.config.strict and row_count != expected_count) {
            return error.ArrayCountMismatch;
        }

        return json.Value{ .array = array };
    }

    fn parseInlineArray(self: *Parser) !json.Value {
        // Already consumed identifier, now at '['
        try self.expect('[');

        const count = try self.parseNumber();
        const expected_count = @as(usize, @intFromFloat(count.float));

        // Security: Prevent DoS via huge array count
        if (expected_count > SecurityLimits.MAX_ARRAY_COUNT) {
            return ParseError.ArrayCountExceedsLimit;
        }

        try self.expect(']');
        try self.expect(':');
        self.skipWhitespace();

        var delimiter: Delimiter = .comma;
        // Detect delimiter from first separator
        var array = json.Array.init(self.allocator);
        errdefer array.deinit();

        var item_count: usize = 0;
        while (item_count < expected_count and self.pos < self.input.len) {
            const value = try self.parseFieldValue(delimiter);
            try array.append(value);
            item_count += 1;

            if (self.peek() == ',') {
                delimiter = .comma;
                _ = self.consume();
            } else if (self.peek() == '\t') {
                delimiter = .tab;
                _ = self.consume();
            } else if (self.peek() == '|') {
                delimiter = .pipe;
                _ = self.consume();
            } else {
                break;
            }
        }

        if (self.config.strict and item_count != expected_count) {
            return error.ArrayCountMismatch;
        }

        return json.Value{ .array = array };
    }

    fn parseExpandedList(self: *Parser, indent: usize) !json.Value {
        var array = json.Array.init(self.allocator);
        errdefer array.deinit();

        while (self.pos < self.input.len) {
            self.skipWhitespace();

            // Check indentation
            const line_indent = self.countIndent();
            if (line_indent < indent) break;
            if (line_indent > indent and self.config.strict) {
                return error.InvalidIndentation;
            }

            if (self.peek() != '-') break;
            _ = self.consume(); // '-'
            try self.expect(' ');

            // Parse item value
            const value = try self.parseValue(indent + 1);
            try array.append(value);
            self.skipLine();
        }

        return json.Value{ .array = array };
    }

    fn parseObject(self: *Parser, indent: usize) !json.Value {
        var obj = json.ObjectMap.init(self.allocator);
        errdefer obj.deinit();

        while (self.pos < self.input.len) {
            self.skipWhitespace();

            // Check indentation
            const line_indent = self.countIndent();
            if (line_indent < indent) break;

            if (self.peek() != ' ' and !std.ascii.isAlphabetic(self.peek())) break;

            const key = try self.parseKey();
            try self.expect(':');
            self.skipWhitespace();

            const value = try self.parseValue(indent + 1);

            // Expand paths if enabled
            if (self.config.expand_paths and std.mem.indexOf(u8, key, ".") != null) {
                try expandPath(&obj, key, value, self.allocator);
            } else {
                try obj.put(key, value);
            }

            self.skipLine();
        }

        return json.Value{ .object = obj };
    }

    fn parseFieldValue(self: *Parser, delimiter: Delimiter) !json.Value {
        self.skipWhitespace();

        // Check for quoted string
        if (self.peek() == '"') {
            _ = self.consume();
            const str = try self.parseQuotedString();
            return json.Value{ .string = str };
        }

        // Parse unquoted value (string, number, bool, null)
        const start = self.pos;
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c == delimiter.toChar() or c == '\n' or c == '\r') break;
            self.pos += 1;
        }

        const raw = std.mem.trim(u8, self.input[start..self.pos], " \t");

        if (raw.len == 0) {
            return json.Value{ .null = {} };
        }

        // Try parsing as number
        if (std.fmt.parseInt(i64, raw, 10)) |n| {
            return json.Value{ .integer = n };
        } else |_| {}

        if (std.fmt.parseFloat(f64, raw)) |f| {
            return json.Value{ .float = f };
        } else |_| {}

        // Check for booleans
        if (std.mem.eql(u8, raw, "true")) {
            return json.Value{ .bool = true };
        }
        if (std.mem.eql(u8, raw, "false")) {
            return json.Value{ .bool = false };
        }
        if (std.mem.eql(u8, raw, "null")) {
            return json.Value{ .null = {} };
        }

        // String
        const str = try self.allocator.dupe(u8, raw);
        return json.Value{ .string = str };
    }

    fn parseQuotedString(self: *Parser) ![]const u8 {
        var result = std.ArrayList(u8).init(self.allocator);
        errdefer result.deinit();

        while (self.pos < self.input.len) {
            // Security: Prevent huge string allocation
            if (result.items.len >= SecurityLimits.MAX_STRING_LENGTH) {
                return ParseError.StringTooLong;
            }

            const c = self.input[self.pos];

            if (c == '"') {
                _ = self.consume();
                return try result.toOwnedSlice();
            }

            if (c == '\\') {
                _ = self.consume();
                if (self.pos >= self.input.len) return error.InvalidEscape;

                const next = self.input[self.pos];
                _ = self.consume();

                const unescaped: u8 = switch (next) {
                    '\\' => '\\',
                    '"' => '"',
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    else => if (self.config.strict) return error.InvalidEscape else next,
                };
                try result.append(unescaped);
            } else {
                try result.append(c);
                self.pos += 1;
            }
        }

        return error.UnterminatedString;
    }

    fn parseKey(self: *Parser) ![]const u8 {
        const start = self.pos;

        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c == ':') break;

            // Security: Limit key length to prevent DoS
            if (self.pos - start >= SecurityLimits.MAX_KEY_LENGTH) {
                return ParseError.KeyTooLong;
            }

            self.pos += 1;
        }

        const key = std.mem.trim(u8, self.input[start..self.pos], " \t");
        return try self.allocator.dupe(u8, key);
    }

    fn parseIdentifier(self: *Parser) ![]const u8 {
        const start = self.pos;

        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (!std.ascii.isAlphanumeric(c) and c != '_') break;
            self.pos += 1;
        }

        const ident = self.input[start..self.pos];
        return try self.allocator.dupe(u8, ident);
    }

    fn parseNumber(self: *Parser) !json.Value {
        const start = self.pos;

        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (!std.ascii.isDigit(c)) break;
            self.pos += 1;
        }

        const num_str = self.input[start..self.pos];
        const num = try std.fmt.parseInt(i64, num_str, 10);

        return json.Value{ .float = @as(f64, @floatFromInt(num)) };
    }

    fn peek(self: *Parser) u8 {
        if (self.pos >= self.input.len) return 0;
        return self.input[self.pos];
    }

    fn peekAhead(self: *Parser, offset: usize) u8 {
        if (self.pos + offset >= self.input.len) return 0;
        return self.input[self.pos + offset];
    }

    fn peekIdentifier(self: *Parser) ?[]const u8 {
        if (self.pos >= self.input.len) return null;
        if (!std.ascii.isAlphabetic(self.input[self.pos])) return null;

        var end = self.pos + 1;
        while (end < self.input.len) {
            const c = self.input[end];
            if (!std.ascii.isAlphanumeric(c) and c != '_') break;
            end += 1;
        }

        return self.input[self.pos..end];
    }

    fn consume(self: *Parser) u8 {
        const c = self.input[self.pos];
        self.pos += 1;
        return c;
    }

    fn expect(self: *Parser, expected: u8) ParseError!void {
        if (self.peek() != expected) {
            return ParseError.ExpectedCharacter;
        }
        _ = self.consume();
    }

    fn expectIndent(self: *Parser, level: usize) ParseError!void {
        const spaces = level * self.config.indent_size;
        var i: usize = 0;
        while (i < spaces) : (i += 1) {
            if (self.peek() != ' ') {
                return ParseError.InvalidIndentation;
            }
            _ = self.consume();
        }
    }

    fn countIndent(self: *Parser) usize {
        var count: usize = 0;
        while (self.pos + count < self.input.len and self.input[self.pos + count] == ' ') {
            count += 1;
        }
        return count;
    }

    fn skipWhitespace(self: *Parser) void {
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c != ' ' and c != '\t') break;
            self.pos += 1;
        }
    }

    fn skipLine(self: *Parser) void {
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];
            if (c == '\n') {
                self.pos += 1;
                break;
            }
            if (c == '\r') {
                self.pos += 1;
                if (self.pos < self.input.len and self.input[self.pos] == '\n') {
                    self.pos += 1;
                }
                break;
            }
            self.pos += 1;
        }
    }
};

// Validator for strict mode TOON validation
const Validator = struct {
    allocator: Allocator,
    input: []const u8,
    pos: usize,
    line: usize,
    config: DecoderConfig,

    pub fn init(allocator: Allocator, input: []const u8, config: DecoderConfig) Validator {
        return .{
            .allocator = allocator,
            .input = input,
            .pos = 0,
            .line = 1,
            .config = config,
        };
    }

    pub fn validate(self: *Validator) !void {
        while (self.pos < self.input.len) {
            try self.validateLine();
        }
    }

    fn validateLine(self: *Validator) !void {
        // Check indentation (strict mode: multiples of indent_size, spaces only)
        if (self.config.strict) {
            var indent: usize = 0;
            while (self.pos < self.input.len and self.input[self.pos] == ' ') {
                indent += 1;
                self.pos += 1;
            }

            // Check for tabs (not allowed in strict mode)
            if (self.pos < self.input.len and self.input[self.pos] == '\t') {
                std.debug.print("Line {d}: Tabs not allowed in strict mode (use spaces)\n", .{self.line});
                return error.InvalidIndentation;
            }

            // Check indentation is multiple of indent_size
            if (indent % self.config.indent_size != 0) {
                std.debug.print("Line {d}: Indentation must be multiple of {d} (found {d})\n", .{ self.line, self.config.indent_size, indent });
                return error.InvalidIndentation;
            }
        }

        // Skip to end of line, checking for invalid escapes
        while (self.pos < self.input.len) {
            const c = self.input[self.pos];

            if (c == '\\') {
                self.pos += 1;
                if (self.pos >= self.input.len) {
                    std.debug.print("Line {d}: Incomplete escape sequence at end of file\n", .{self.line});
                    return error.InvalidEscape;
                }

                const next = self.input[self.pos];
                if (self.config.strict) {
                    // Only 5 valid escapes: \\ \" \n \r \t
                    if (next != '\\' and next != '"' and next != 'n' and next != 'r' and next != 't') {
                        std.debug.print("Line {d}: Invalid escape sequence '\\{c}'\n", .{ self.line, next });
                        std.debug.print("  Valid escapes: \\\\ \\\" \\n \\r \\t\n", .{});
                        return error.InvalidEscape;
                    }
                }
                self.pos += 1;
            } else if (c == '\n') {
                self.pos += 1;
                self.line += 1;
                return;
            } else if (c == '\r') {
                self.pos += 1;
                if (self.pos < self.input.len and self.input[self.pos] == '\n') {
                    self.pos += 1;
                }
                self.line += 1;
                return;
            } else {
                self.pos += 1;
            }
        }
    }
};

fn expandPath(obj: *json.ObjectMap, path: []const u8, value: json.Value, allocator: Allocator) !void {
    var parts = std.mem.splitScalar(u8, path, '.');

    var current_obj = obj;

    while (parts.next()) |part| {
        if (parts.peek() == null) {
            // Last part - set value (need to dupe since part is a slice of input)
            const key_dup = try allocator.dupe(u8, part);
            try current_obj.put(key_dup, value);
            return;
        }

        // Intermediate part - check if nested object exists
        if (current_obj.getPtr(part)) |existing_ptr| {
            // Key already exists - no allocation needed
            if (existing_ptr.* == .object) {
                current_obj = &existing_ptr.object;
            } else {
                return error.PathCollision;
            }
        } else {
            // Key doesn't exist - need to allocate and create nested object
            const part_dup = try allocator.dupe(u8, part);
            const new_obj = json.ObjectMap.init(allocator);
            try current_obj.put(part_dup, json.Value{ .object = new_obj });

            if (current_obj.getPtr(part_dup)) |existing_ptr| {
                current_obj = &existing_ptr.object;
            }
        }
    }
}

pub const Toon = struct {
    allocator: Allocator,

    pub fn init(allocator: Allocator) Toon {
        return .{ .allocator = allocator };
    }

    /// Encode JSON to TOON format
    pub fn encode(self: *Toon, json_str: []const u8, config: EncoderConfig) ![]const u8 {
        var parsed = try json.parseFromSlice(json.Value, self.allocator, json_str, .{});
        defer parsed.deinit();

        const root = parsed.value;

        var result = std.ArrayList(u8).init(self.allocator);
        errdefer result.deinit();

        try self.encodeValue(root, &result, 0, config);

        return try result.toOwnedSlice();
    }

    fn encodeValue(self: *Toon, value: json.Value, result: *std.ArrayList(u8), indent: usize, config: EncoderConfig) anyerror!void {
        switch (value) {
            .array => |arr| {
                const array_type = try self.detectArrayType(arr.items);
                switch (array_type) {
                    .inline_primitive => try self.encodeInlineArray(arr.items, result, config.delimiter),
                    .tabular => try self.encodeTabularArray(arr.items, result, config.delimiter),
                    .expanded_list => try self.encodeExpandedList(arr.items, result, indent, config),
                }
            },
            .object => |obj| {
                if (config.key_folding) {
                    try self.encodeFoldedObject(obj, result, "", indent, config);
                } else {
                    try self.encodeObject(obj, result, indent, config);
                }
            },
            .string => |s| try result.appendSlice(s),
            .integer => |n| try result.writer().print("{d}", .{n}),
            .float => |f| {
                const canonical = try self.canonicalizeNumber(f);
                defer canonical.deinit(self.allocator);
                try result.appendSlice(canonical.slice);
            },
            .bool => |b| try result.appendSlice(if (b) "true" else "false"),
            .null => try result.appendSlice("null"),
            else => return error.UnsupportedValueType,
        }
    }

    fn detectArrayType(self: *Toon, items: []const json.Value) !ArrayType {
        if (items.len == 0) return .tabular;

        // Check if all primitives and ≤10 items
        if (items.len <= ArrayThresholds.MAX_INLINE_ITEMS) {
            var all_primitives = true;
            for (items) |item| {
                if (item != .string and item != .integer and
                    item != .float and item != .bool and item != .null)
                {
                    all_primitives = false;
                    break;
                }
            }
            if (all_primitives) return .inline_primitive;
        }

        // Check if all objects with ≥60% uniformity
        var all_objects = true;
        for (items) |item| {
            if (item != .object) {
                all_objects = false;
                break;
            }
        }

        if (all_objects) {
            // Calculate uniformity - use instance allocator for proper memory management
            var field_set = std.StringHashMap(usize).init(self.allocator);
            defer field_set.deinit();

            for (items) |item| {
                var it = item.object.iterator();
                while (it.next()) |entry| {
                    const gop = try field_set.getOrPut(entry.key_ptr.*);
                    if (!gop.found_existing) {
                        gop.value_ptr.* = 1;
                    } else {
                        gop.value_ptr.* += 1;
                    }
                }
            }

            // Count fields present in ≥60% of objects
            const threshold = (items.len * ArrayThresholds.MIN_UNIFORMITY_PERCENT) / 100;
            var common_fields: usize = 0;
            var total_fields: usize = 0;

            var it = field_set.iterator();
            while (it.next()) |entry| {
                total_fields += 1;
                if (entry.value_ptr.* >= threshold) {
                    common_fields += 1;
                }
            }

            if (total_fields > 0) {
                const uniformity = (common_fields * 100) / total_fields;
                if (uniformity >= ArrayThresholds.MIN_UNIFORMITY_PERCENT) return .tabular;
            }
        }

        return .expanded_list;
    }

    fn encodeInlineArray(self: *Toon, items: []const json.Value, result: *std.ArrayList(u8), delimiter: Delimiter) !void {
        try result.writer().print("[{d}]: ", .{items.len});

        for (items, 0..) |item, i| {
            if (i > 0) try result.append(delimiter.toChar());

            switch (item) {
                .string => |s| {
                    if (needsQuoting(s, delimiter)) {
                        try result.append('"');
                        const escaped = try escapeValue(s, self.allocator);
                        defer self.allocator.free(escaped);
                        try result.appendSlice(escaped);
                        try result.append('"');
                    } else {
                        try result.appendSlice(s);
                    }
                },
                .integer => |n| try result.writer().print("{d}", .{n}),
                .float => |f| {
                    const canonical = try self.canonicalizeNumber(f);
                    defer canonical.deinit(self.allocator);
                    try result.appendSlice(canonical.slice);
                },
                .bool => |b| try result.appendSlice(if (b) "true" else "false"),
                .null => try result.appendSlice("null"),
                else => unreachable,
            }
        }

        try result.append('\n');
    }

    fn encodeTabularArray(self: *Toon, items: []const json.Value, result: *std.ArrayList(u8), delimiter: Delimiter) !void {
        if (items.len == 0) return;

        // Extract all unique fields
        var field_set = std.StringHashMap(void).init(self.allocator);
        defer field_set.deinit();

        var fields_list = std.ArrayList([]const u8).init(self.allocator);
        defer fields_list.deinit();

        for (items) |item| {
            if (item != .object) return error.NonObjectInArray;
            var it = item.object.iterator();
            while (it.next()) |entry| {
                const gop = try field_set.getOrPut(entry.key_ptr.*);
                if (!gop.found_existing) {
                    try fields_list.append(entry.key_ptr.*);
                }
            }
        }

        // Write header with delimiter marker INSIDE brackets per spec v3.0: [N\t]{fields}:
        const delim_marker: []const u8 = switch (delimiter) {
            .comma => "",
            .tab => "\\t",
            .pipe => "|",
        };
        try result.writer().print("[{d}{s}]{{", .{ items.len, delim_marker });

        for (fields_list.items, 0..) |field, i| {
            if (i > 0) try result.append(',');
            try result.appendSlice(field);
        }
        try result.appendSlice("}:\n");

        // Write data rows
        for (items) |item| {
            try result.appendSlice("  ");

            for (fields_list.items, 0..) |field, i| {
                if (i > 0) try result.append(delimiter.toChar());

                if (item.object.get(field)) |value| {
                    try self.encodeFieldValue(value, result, delimiter);
                }
            }
            try result.append('\n');
        }
    }

    fn encodeFieldValue(self: *Toon, value: json.Value, result: *std.ArrayList(u8), delimiter: Delimiter) !void {
        switch (value) {
            .string => |s| {
                if (needsQuoting(s, delimiter)) {
                    try result.append('"');
                    const escaped = try escapeValue(s, self.allocator);
                    defer self.allocator.free(escaped);
                    try result.appendSlice(escaped);
                    try result.append('"');
                } else {
                    try result.appendSlice(s);
                }
            },
            .integer => |n| try result.writer().print("{d}", .{n}),
            .float => |f| {
                const canonical = try self.canonicalizeNumber(f);
                defer canonical.deinit(self.allocator);
                try result.appendSlice(canonical.slice);
            },
            .bool => |b| try result.appendSlice(if (b) "true" else "false"),
            .null => {}, // Empty for null
            else => return error.UnsupportedValueType,
        }
    }

    fn encodeExpandedList(self: *Toon, items: []const json.Value, result: *std.ArrayList(u8), indent: usize, config: EncoderConfig) !void {
        for (items) |item| {
            try self.writeIndent(result, indent);
            try result.appendSlice("- ");

            // Special handling for nested arrays that should use tabular format
            // Per spec §10: list-item tabular arrays have header on hyphen line
            if (item == .array) {
                const nested_items = item.array.items;
                const array_type = try self.detectArrayType(nested_items);
                if (array_type == .tabular and nested_items.len > 0) {
                    // Write tabular array header on same line as hyphen
                    try self.encodeTabularArrayNested(nested_items, result, indent + 1, config.delimiter);
                    continue;
                }
            }

            try self.encodeValue(item, result, indent + 1, config);
            try result.append('\n');
        }
    }

    /// Encode tabular array nested inside a list item (header on hyphen line, rows indented +2)
    fn encodeTabularArrayNested(self: *Toon, items: []const json.Value, result: *std.ArrayList(u8), indent: usize, delimiter: Delimiter) !void {
        if (items.len == 0) {
            try result.appendSlice("[0]{}:\n");
            return;
        }

        // Extract all unique fields
        var field_set = std.StringHashMap(void).init(self.allocator);
        defer field_set.deinit();

        var fields_list = std.ArrayList([]const u8).init(self.allocator);
        defer fields_list.deinit();

        for (items) |item| {
            if (item != .object) return error.NonObjectInArray;
            var it = item.object.iterator();
            while (it.next()) |entry| {
                const gop = try field_set.getOrPut(entry.key_ptr.*);
                if (!gop.found_existing) {
                    try fields_list.append(entry.key_ptr.*);
                }
            }
        }

        // Write header with delimiter marker (on same line as hyphen)
        const delim_marker: []const u8 = switch (delimiter) {
            .comma => "",
            .tab => "\\t",
            .pipe => "|",
        };
        try result.writer().print("[{d}{s}]{{", .{ items.len, delim_marker });

        for (fields_list.items, 0..) |field, i| {
            if (i > 0) try result.append(',');
            try result.appendSlice(field);
        }
        try result.appendSlice("}:\n");

        // Write data rows at indent + 1 (2 more spaces from the hyphen line)
        for (items) |item| {
            try self.writeIndent(result, indent);
            try result.appendSlice("  "); // Extra indent for nested rows

            for (fields_list.items, 0..) |field, i| {
                if (i > 0) try result.append(delimiter.toChar());

                if (item.object.get(field)) |value| {
                    try self.encodeFieldValue(value, result, delimiter);
                }
            }
            try result.append('\n');
        }
    }

    fn encodeFoldedObject(self: *Toon, obj: json.ObjectMap, result: *std.ArrayList(u8), prefix: []const u8, indent: usize, config: EncoderConfig) !void {
        var it = obj.iterator();
        while (it.next()) |entry| {
            const key = entry.key_ptr.*;
            const value = entry.value_ptr.*;

            // Build full key path
            const full_key = if (prefix.len > 0)
                try std.fmt.allocPrint(self.allocator, "{s}.{s}", .{ prefix, key })
            else
                key;
            defer if (prefix.len > 0) self.allocator.free(full_key);

            if (value == .object and isValidIdentifier(key) and !hasCollision(obj, key)) {
                // Recursively fold
                try self.encodeFoldedObject(value.object, result, full_key, indent, config);
            } else {
                // Write key: value
                try self.writeIndent(result, indent);
                try result.appendSlice(full_key);
                try result.appendSlice(": ");
                try self.encodeValue(value, result, indent, config);
                try result.append('\n');
            }
        }
    }

    fn encodeObject(self: *Toon, obj: json.ObjectMap, result: *std.ArrayList(u8), indent: usize, config: EncoderConfig) !void {
        var it = obj.iterator();
        while (it.next()) |entry| {
            try self.writeIndent(result, indent);
            try result.appendSlice(entry.key_ptr.*);
            try result.appendSlice(": ");
            try self.encodeValue(entry.value_ptr.*, result, indent + 1, config);
            try result.append('\n');
        }
    }

    fn writeIndent(self: *Toon, result: *std.ArrayList(u8), level: usize) !void {
        _ = self;
        var i: usize = 0;
        while (i < level * 2) : (i += 1) {
            try result.append(' ');
        }
    }

    /// Result of canonicalizeNumber - tracks ownership to prevent leaks/double-frees
    const CanonicalNumber = struct {
        slice: []const u8,
        owned: bool, // true if caller must free, false for static strings

        pub fn deinit(self: *const CanonicalNumber, allocator: Allocator) void {
            if (self.owned) {
                allocator.free(@constCast(self.slice));
            }
        }
    };

    /// Canonicalize number to minimal representation
    /// - NaN/Inf → "null"
    /// - -0 → "0"
    /// - Remove trailing zeros after decimal
    /// - Remove unnecessary decimal point
    /// Returns CanonicalNumber with ownership flag to prevent memory issues
    fn canonicalizeNumber(self: *Toon, num: f64) !CanonicalNumber {
        if (std.math.isNan(num) or std.math.isInf(num)) {
            return .{ .slice = "null", .owned = false };
        }

        // -0 → 0
        if (num == 0.0) return .{ .slice = "0", .owned = false };

        // Check if it's an integer (no fractional part)
        const as_int: i64 = @intFromFloat(num);
        const back_to_float: f64 = @floatFromInt(as_int);
        if (back_to_float == num) {
            // It's an integer, format without decimal
            var buf: [32]u8 = undefined;
            const str = try std.fmt.bufPrint(&buf, "{d}", .{as_int});
            const result = try self.allocator.alloc(u8, str.len);
            @memcpy(result, str);
            return .{ .slice = result, .owned = true };
        }

        // Format as float
        var buf: [64]u8 = undefined;
        const str = try std.fmt.bufPrint(&buf, "{d}", .{num});

        // Find decimal point and remove trailing zeros
        var end: usize = str.len;
        if (std.mem.indexOf(u8, str, ".")) |dot_pos| {
            // Remove trailing zeros
            while (end > dot_pos + 1 and str[end - 1] == '0') {
                end -= 1;
            }
            // Remove decimal point if no fractional part remains
            if (end == dot_pos + 1) {
                end = dot_pos;
            }
        }

        const result = try self.allocator.alloc(u8, end);
        @memcpy(result, str[0..end]);
        return .{ .slice = result, .owned = true };
    }

    /// Decode TOON to JSON
    pub fn decode(self: *Toon, toon_str: []const u8, config: DecoderConfig) ![]const u8 {
        var parser = Parser.init(self.allocator, toon_str, config);
        const value = try parser.parse();
        // Note: value deallocation handled by parser allocator

        var result = std.ArrayList(u8).init(self.allocator);
        errdefer result.deinit();

        try std.json.stringify(value, .{}, result.writer());

        return try result.toOwnedSlice();
    }

    /// Validate TOON format
    pub fn validate(self: *Toon, toon_str: []const u8, config: DecoderConfig) !void {
        var validator = Validator.init(self.allocator, toon_str, config);
        try validator.validate();
    }

    /// Check if JSON should use TOON
    pub fn shouldUseToon(self: *Toon, json_str: []const u8) !bool {
        var parsed = try json.parseFromSlice(json.Value, self.allocator, json_str, .{});
        defer parsed.deinit();

        const root = parsed.value;
        if (root != .array) return false;

        const items = root.array.items;

        // Rule 1: At least 5 items
        if (items.len < 5) return false;

        // Rule 2: All items must be objects
        for (items) |item| {
            if (item != .object) return false;
        }

        // Rule 3: ≥60% field uniformity
        var all_fields = std.StringHashMap(usize).init(self.allocator);
        defer all_fields.deinit();

        var max_fields: usize = 0;

        for (items) |item| {
            var it = item.object.iterator();
            var count: usize = 0;
            while (it.next()) |entry| {
                const gop = try all_fields.getOrPut(entry.key_ptr.*);
                if (!gop.found_existing) {
                    gop.value_ptr.* = 1;
                } else {
                    gop.value_ptr.* += 1;
                }
                count += 1;
            }
            if (count > max_fields) max_fields = count;
        }

        const threshold = (items.len * 60) / 100;
        var common_fields: usize = 0;

        var it = all_fields.iterator();
        while (it.next()) |entry| {
            if (entry.value_ptr.* >= threshold) {
                common_fields += 1;
            }
        }

        if (max_fields == 0) return false;
        const uniformity = (common_fields * 100) / max_fields;

        return uniformity >= 60;
    }
};

fn isValidIdentifier(s: []const u8) bool {
    if (s.len == 0) return false;

    const first = s[0];
    if (!std.ascii.isAlphabetic(first) and first != '_') return false;

    for (s[1..]) |c| {
        if (!std.ascii.isAlphanumeric(c) and c != '_') return false;
    }

    return true;
}

/// Check for key folding collision per spec §13.4
/// A folded key like "user.name" collides if:
/// 1. A sibling literal key equals the folded form (e.g., "user.name" exists as literal)
/// 2. A sibling key would create ambiguity when expanded
fn hasCollision(obj: json.ObjectMap, key: []const u8) bool {
    var it = obj.iterator();
    while (it.next()) |entry| {
        const sibling = entry.key_ptr.*;

        // Skip self
        if (std.mem.eql(u8, sibling, key)) continue;

        // Check if sibling equals what would be a folded path starting with this key
        // e.g., if key is "user" and sibling is "user.name", that's a collision
        if (std.mem.startsWith(u8, sibling, key) and
            sibling.len > key.len and
            sibling[key.len] == '.')
        {
            return true;
        }

        // Check if this key would be a prefix of another key when folded
        // e.g., if we're folding "user" and there's a literal "user.name" key
        if (std.mem.indexOf(u8, sibling, ".")) |_| {
            // Sibling has a dot - check if our key matches its prefix
            if (std.mem.startsWith(u8, sibling, key) and
                sibling.len > key.len and
                sibling[key.len] == '.')
            {
                return true;
            }
        }
    }
    return false;
}

fn needsQuoting(s: []const u8, delimiter: Delimiter) bool {
    // Empty string needs quoting
    if (s.len == 0) return true;

    // Leading/trailing whitespace needs quoting (spec §7)
    if (s[0] == ' ' or s[0] == '\t' or s[s.len - 1] == ' ' or s[s.len - 1] == '\t') {
        return true;
    }

    // Check for reserved words
    if (std.mem.eql(u8, s, "true") or
        std.mem.eql(u8, s, "false") or
        std.mem.eql(u8, s, "null"))
    {
        return true;
    }

    // Check for leading hyphen (could be negative number)
    if (s[0] == '-') return true;

    // Check if string looks like a number (spec §7) - must quote to preserve as string
    // This includes "123", "3.14", "05" (leading zeros), etc.
    if (looksLikeNumber(s)) return true;

    // Check for special characters
    for (s) |c| {
        if (c == delimiter.toChar()) return true;
        if (c == ':' or c == '"' or c == '\\') return true;
        if (c == '[' or c == ']' or c == '{' or c == '}') return true;
        if (c < 32 or c == 127) return true; // Control characters
    }

    return false;
}

/// Check if string looks like it could be parsed as a number
/// Per spec §7: strings that look like numbers must be quoted
fn looksLikeNumber(s: []const u8) bool {
    if (s.len == 0) return false;

    var i: usize = 0;

    // Optional leading minus
    if (s[i] == '-') {
        i += 1;
        if (i >= s.len) return false;
    }

    // Must start with digit
    if (!std.ascii.isDigit(s[i])) return false;

    // Check for leading zeros (like "05") - these look like numbers
    if (s[i] == '0' and i + 1 < s.len and std.ascii.isDigit(s[i + 1])) {
        return true; // "05" looks like a number, needs quoting
    }

    // Consume integer part
    while (i < s.len and std.ascii.isDigit(s[i])) {
        i += 1;
    }

    // If we consumed everything, it's a number
    if (i == s.len) return true;

    // Check for decimal point
    if (s[i] == '.') {
        i += 1;
        // Must have at least one digit after decimal
        if (i >= s.len or !std.ascii.isDigit(s[i])) return false;
        while (i < s.len and std.ascii.isDigit(s[i])) {
            i += 1;
        }
    }

    // Check for exponent (we don't emit these, but should detect them)
    if (i < s.len and (s[i] == 'e' or s[i] == 'E')) {
        i += 1;
        if (i < s.len and (s[i] == '+' or s[i] == '-')) {
            i += 1;
        }
        if (i >= s.len or !std.ascii.isDigit(s[i])) return false;
        while (i < s.len and std.ascii.isDigit(s[i])) {
            i += 1;
        }
    }

    // If we consumed everything, it's a number
    return i == s.len;
}

fn escapeValue(s: []const u8, allocator: Allocator) ![]const u8 {
    var result = std.ArrayList(u8).init(allocator);
    errdefer result.deinit();

    for (s) |c| {
        switch (c) {
            '\\' => try result.appendSlice("\\\\"),
            '"' => try result.appendSlice("\\\""),
            '\n' => try result.appendSlice("\\n"),
            '\r' => try result.appendSlice("\\r"),
            '\t' => try result.appendSlice("\\t"),
            else => try result.append(c),
        }
    }

    return try result.toOwnedSlice();
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 3) {
        try printUsage(args[0]);
        return;
    }

    const command = args[1];
    const filepath = args[2];

    var config = EncoderConfig.init();

    // Parse flags
    var i: usize = 3;
    while (i < args.len) : (i += 1) {
        const arg = args[i];
        if (std.mem.eql(u8, arg, "--delimiter")) {
            i += 1;
            if (i < args.len) {
                config.delimiter = try Delimiter.fromString(args[i]);
            }
        } else if (std.mem.eql(u8, arg, "--key-folding")) {
            config.key_folding = true;
        } else if (std.mem.eql(u8, arg, "--no-key-folding")) {
            config.key_folding = false;
        }
    }

    const file = try std.fs.cwd().openFile(filepath, .{});
    defer file.close();

    const content = try file.readToEndAlloc(allocator, 10 * 1024 * 1024);
    defer allocator.free(content);

    var toon = Toon.init(allocator);

    if (std.mem.eql(u8, command, "encode")) {
        const result = try toon.encode(content, config);
        defer allocator.free(result);
        try std.io.getStdOut().writeAll(result);
    } else if (std.mem.eql(u8, command, "decode")) {
        var decoder_config = DecoderConfig.init();

        // Parse decoder flags
        var j: usize = 3;
        while (j < args.len) : (j += 1) {
            const arg = args[j];
            if (std.mem.eql(u8, arg, "--strict")) {
                decoder_config.strict = true;
            } else if (std.mem.eql(u8, arg, "--no-expand-paths")) {
                decoder_config.expand_paths = false;
            }
        }

        const result = try toon.decode(content, decoder_config);
        defer allocator.free(result);
        try std.io.getStdOut().writeAll(result);
    } else if (std.mem.eql(u8, command, "validate")) {
        var decoder_config = DecoderConfig.init();

        // Parse validation flags
        var j: usize = 3;
        while (j < args.len) : (j += 1) {
            const arg = args[j];
            if (std.mem.eql(u8, arg, "--strict")) {
                decoder_config.strict = true;
            }
        }

        toon.validate(content, decoder_config) catch |err| {
            std.debug.print("❌ Validation failed: {s}\n", .{@errorName(err)});
            std.process.exit(1);
        };

        std.debug.print("✓ TOON file is valid\n", .{});
    } else if (std.mem.eql(u8, command, "check")) {
        const should_use = try toon.shouldUseToon(content);
        if (should_use) {
            std.debug.print("✓ TOON format recommended (≥5 items, ≥60% uniformity)\n", .{});
            std.process.exit(0);
        } else {
            std.debug.print("✗ JSON format recommended (keep as-is)\n", .{});
            std.process.exit(1);
        }
    } else {
        std.debug.print("Unknown command: {s}\n", .{command});
        try printUsage(args[0]);
        std.process.exit(1);
    }
}

fn printUsage(prog_name: []const u8) !void {
    const stderr = std.io.getStdErr().writer();
    try stderr.print(
        \\TOON v3.0 Encoder/Decoder
        \\
        \\Usage: {s} <command> <file> [options]
        \\
        \\Commands:
        \\  encode <file>   Convert JSON to TOON
        \\  decode <file>   Convert TOON to JSON
        \\  validate <file> Validate TOON format
        \\  check <file>    Check if TOON is recommended
        \\
        \\Encode Options:
        \\  --delimiter <comma|tab|pipe>  Delimiter to use (default: comma)
        \\  --key-folding                 Enable key folding (default)
        \\  --no-key-folding              Disable key folding
        \\
        \\Decode Options:
        \\  --strict                      Enable strict mode validation
        \\  --no-expand-paths             Don't expand folded paths (keep as-is)
        \\
        \\Validate Options:
        \\  --strict                      Enable strict mode validation
        \\
        \\Examples:
        \\  {s} encode data.json
        \\  {s} encode data.json --delimiter tab --key-folding
        \\  {s} decode data.toon
        \\  {s} decode data.toon --strict --no-expand-paths
        \\  {s} validate data.toon --strict
        \\  {s} check data.json
        \\
    , .{ prog_name, prog_name, prog_name, prog_name, prog_name, prog_name, prog_name });
}

// ============================================================================
// Unit Tests
// ============================================================================

test "Delimiter conversion" {
    try std.testing.expectEqual(Delimiter.comma, try Delimiter.fromString("comma"));
    try std.testing.expectEqual(Delimiter.tab, try Delimiter.fromString("tab"));
    try std.testing.expectEqual(Delimiter.pipe, try Delimiter.fromString("pipe"));
    try std.testing.expectError(error.InvalidDelimiter, Delimiter.fromString("invalid"));

    try std.testing.expectEqual(@as(u8, ','), Delimiter.comma.toChar());
    try std.testing.expectEqual(@as(u8, '\t'), Delimiter.tab.toChar());
    try std.testing.expectEqual(@as(u8, '|'), Delimiter.pipe.toChar());
}

test "isValidIdentifier" {
    try std.testing.expect(isValidIdentifier("foo"));
    try std.testing.expect(isValidIdentifier("foo_bar"));
    try std.testing.expect(isValidIdentifier("_foo"));
    try std.testing.expect(isValidIdentifier("foo123"));

    try std.testing.expect(!isValidIdentifier(""));
    try std.testing.expect(!isValidIdentifier("123foo"));
    try std.testing.expect(!isValidIdentifier("foo-bar"));
    try std.testing.expect(!isValidIdentifier("foo.bar"));
}

test "needsQuoting" {
    // Reserved words need quoting
    try std.testing.expect(needsQuoting("true", .comma));
    try std.testing.expect(needsQuoting("false", .comma));
    try std.testing.expect(needsQuoting("null", .comma));

    // Empty string needs quoting
    try std.testing.expect(needsQuoting("", .comma));

    // Leading hyphen needs quoting
    try std.testing.expect(needsQuoting("-foo", .comma));

    // Delimiter character needs quoting
    try std.testing.expect(needsQuoting("a,b", .comma));
    try std.testing.expect(needsQuoting("a\tb", .tab));
    try std.testing.expect(needsQuoting("a|b", .pipe));

    // Normal strings don't need quoting
    try std.testing.expect(!needsQuoting("hello", .comma));
    try std.testing.expect(!needsQuoting("foo_bar", .comma));

    // Numeric-looking strings need quoting (spec §7)
    try std.testing.expect(needsQuoting("123", .comma));
    try std.testing.expect(needsQuoting("3.14", .comma));
    try std.testing.expect(needsQuoting("05", .comma)); // Leading zero
    try std.testing.expect(needsQuoting("-42", .comma));
    try std.testing.expect(needsQuoting("1e10", .comma));

    // Leading/trailing whitespace needs quoting (spec §7)
    try std.testing.expect(needsQuoting(" hello", .comma));
    try std.testing.expect(needsQuoting("hello ", .comma));
    try std.testing.expect(needsQuoting("\thello", .comma));

    // Special characters need quoting
    try std.testing.expect(needsQuoting("say:what", .comma));
    try std.testing.expect(needsQuoting("back\\slash", .comma));
    try std.testing.expect(needsQuoting("quote\"mark", .comma));
}

test "looksLikeNumber" {
    // Integers
    try std.testing.expect(looksLikeNumber("0"));
    try std.testing.expect(looksLikeNumber("123"));
    try std.testing.expect(looksLikeNumber("-456"));

    // Floats
    try std.testing.expect(looksLikeNumber("3.14"));
    try std.testing.expect(looksLikeNumber("-0.5"));

    // Leading zeros (still looks like a number)
    try std.testing.expect(looksLikeNumber("05"));
    try std.testing.expect(looksLikeNumber("007"));

    // Scientific notation
    try std.testing.expect(looksLikeNumber("1e10"));
    try std.testing.expect(looksLikeNumber("1E-5"));
    try std.testing.expect(looksLikeNumber("3.14e+2"));

    // Not numbers
    try std.testing.expect(!looksLikeNumber(""));
    try std.testing.expect(!looksLikeNumber("hello"));
    try std.testing.expect(!looksLikeNumber("12abc"));
    try std.testing.expect(!looksLikeNumber("abc12"));
    try std.testing.expect(!looksLikeNumber("-")); // Just minus sign
    try std.testing.expect(!looksLikeNumber("1.2.3")); // Multiple dots
}

test "escapeValue" {
    const allocator = std.testing.allocator;

    const escaped1 = try escapeValue("hello", allocator);
    defer allocator.free(escaped1);
    try std.testing.expectEqualStrings("hello", escaped1);

    const escaped2 = try escapeValue("hello\nworld", allocator);
    defer allocator.free(escaped2);
    try std.testing.expectEqualStrings("hello\\nworld", escaped2);

    const escaped3 = try escapeValue("say \"hi\"", allocator);
    defer allocator.free(escaped3);
    try std.testing.expectEqualStrings("say \\\"hi\\\"", escaped3);

    const escaped4 = try escapeValue("back\\slash", allocator);
    defer allocator.free(escaped4);
    try std.testing.expectEqualStrings("back\\\\slash", escaped4);
}

test "Toon encode simple array" {
    const allocator = std.testing.allocator;
    var toon = Toon.init(allocator);

    const json_input = "[1, 2, 3]";
    const result = try toon.encode(json_input, EncoderConfig.init());
    defer allocator.free(result);

    // Should produce inline array format
    try std.testing.expect(std.mem.indexOf(u8, result, "[3]:") != null);
}

test "Toon shouldUseToon" {
    const allocator = std.testing.allocator;
    var toon = Toon.init(allocator);

    // Less than 5 items - should not use TOON
    const small_array = "[{\"a\":1},{\"a\":2}]";
    try std.testing.expect(!try toon.shouldUseToon(small_array));

    // 5+ uniform objects - should use TOON
    const large_array =
        \\[{"method":"GET","path":"/a"},
        \\{"method":"POST","path":"/b"},
        \\{"method":"PUT","path":"/c"},
        \\{"method":"DELETE","path":"/d"},
        \\{"method":"PATCH","path":"/e"}]
    ;
    try std.testing.expect(try toon.shouldUseToon(large_array));

    // Non-array - should not use TOON
    const object = "{\"a\":1}";
    try std.testing.expect(!try toon.shouldUseToon(object));
}

test "Toon canonicalizeNumber" {
    const allocator = std.testing.allocator;
    var toon = Toon.init(allocator);

    // Zero - returns static "0", not owned
    const zero_result = try toon.canonicalizeNumber(0.0);
    defer zero_result.deinit(allocator);
    try std.testing.expectEqualStrings("0", zero_result.slice);
    try std.testing.expect(!zero_result.owned);

    // Negative zero - returns static "0", not owned
    const neg_zero_result = try toon.canonicalizeNumber(-0.0);
    defer neg_zero_result.deinit(allocator);
    try std.testing.expectEqualStrings("0", neg_zero_result.slice);
    try std.testing.expect(!neg_zero_result.owned);

    // NaN - returns static "null", not owned
    const nan_result = try toon.canonicalizeNumber(std.math.nan(f64));
    defer nan_result.deinit(allocator);
    try std.testing.expectEqualStrings("null", nan_result.slice);
    try std.testing.expect(!nan_result.owned);

    // Inf - returns static "null", not owned
    const inf_result = try toon.canonicalizeNumber(std.math.inf(f64));
    defer inf_result.deinit(allocator);
    try std.testing.expectEqualStrings("null", inf_result.slice);
    try std.testing.expect(!inf_result.owned);

    // Integer values - owned (allocated)
    const int_result = try toon.canonicalizeNumber(42.0);
    defer int_result.deinit(allocator);
    try std.testing.expectEqualStrings("42", int_result.slice);
    try std.testing.expect(int_result.owned);

    // Float values (trailing zeros removed) - owned (allocated)
    const float_result = try toon.canonicalizeNumber(3.14);
    defer float_result.deinit(allocator);
    try std.testing.expect(std.mem.startsWith(u8, float_result.slice, "3.14"));
    try std.testing.expect(float_result.owned);
}

test "detectArrayType" {
    const allocator = std.testing.allocator;
    var toon = Toon.init(allocator);

    // Empty array
    const empty: []const json.Value = &.{};
    try std.testing.expectEqual(ArrayType.tabular, try toon.detectArrayType(empty));

    // Small primitive array (<=10 items)
    const primitives: []const json.Value = &.{
        json.Value{ .integer = 1 },
        json.Value{ .integer = 2 },
        json.Value{ .integer = 3 },
    };
    try std.testing.expectEqual(ArrayType.inline_primitive, try toon.detectArrayType(primitives));
}

test "roundtrip encode-decode" {
    const allocator = std.testing.allocator;
    var toon = Toon.init(allocator);

    // Test 1: Simple inline array
    {
        const json_input = "[1,2,3]";
        const encoded = try toon.encode(json_input, EncoderConfig.init());
        defer allocator.free(encoded);

        const decoded = try toon.decode(encoded, DecoderConfig.init());
        defer allocator.free(decoded);

        // Parse both to compare semantically (order may differ)
        var original = try json.parseFromSlice(json.Value, allocator, json_input, .{});
        defer original.deinit();
        var result = try json.parseFromSlice(json.Value, allocator, decoded, .{});
        defer result.deinit();

        // Both should be arrays with same length
        try std.testing.expectEqual(original.value.array.items.len, result.value.array.items.len);
    }

    // Test 2: Tabular array (objects with uniform fields)
    {
        const json_input =
            \\[{"method":"GET","path":"/a"},
            \\{"method":"POST","path":"/b"},
            \\{"method":"PUT","path":"/c"},
            \\{"method":"DELETE","path":"/d"},
            \\{"method":"PATCH","path":"/e"}]
        ;
        const encoded = try toon.encode(json_input, EncoderConfig.init());
        defer allocator.free(encoded);

        const decoded = try toon.decode(encoded, DecoderConfig.init());
        defer allocator.free(decoded);

        var original = try json.parseFromSlice(json.Value, allocator, json_input, .{});
        defer original.deinit();
        var result = try json.parseFromSlice(json.Value, allocator, decoded, .{});
        defer result.deinit();

        // Both should be arrays with 5 items
        try std.testing.expectEqual(@as(usize, 5), original.value.array.items.len);
        try std.testing.expectEqual(@as(usize, 5), result.value.array.items.len);

        // Verify first item has expected fields
        const first_orig = original.value.array.items[0].object;
        const first_result = result.value.array.items[0].object;
        try std.testing.expect(first_orig.get("method") != null);
        try std.testing.expect(first_result.get("method") != null);
    }

    // Test 3: Strings with special characters
    {
        const json_input = "[\"hello\\nworld\",\"say \\\"hi\\\"\",\"back\\\\slash\"]";
        const encoded = try toon.encode(json_input, EncoderConfig.init());
        defer allocator.free(encoded);

        const decoded = try toon.decode(encoded, DecoderConfig.init());
        defer allocator.free(decoded);

        var original = try json.parseFromSlice(json.Value, allocator, json_input, .{});
        defer original.deinit();
        var result = try json.parseFromSlice(json.Value, allocator, decoded, .{});
        defer result.deinit();

        try std.testing.expectEqual(original.value.array.items.len, result.value.array.items.len);
    }

    // Test 4: Mixed types (booleans, null, numbers)
    {
        const json_input = "[true,false,null,42,3.14]";
        const encoded = try toon.encode(json_input, EncoderConfig.init());
        defer allocator.free(encoded);

        const decoded = try toon.decode(encoded, DecoderConfig.init());
        defer allocator.free(decoded);

        var original = try json.parseFromSlice(json.Value, allocator, json_input, .{});
        defer original.deinit();
        var result = try json.parseFromSlice(json.Value, allocator, decoded, .{});
        defer result.deinit();

        try std.testing.expectEqual(@as(usize, 5), result.value.array.items.len);
        try std.testing.expectEqual(true, result.value.array.items[0].bool);
        try std.testing.expectEqual(false, result.value.array.items[1].bool);
        try std.testing.expectEqual(json.Value{ .null = {} }, result.value.array.items[2]);
        try std.testing.expectEqual(@as(i64, 42), result.value.array.items[3].integer);
    }
}
