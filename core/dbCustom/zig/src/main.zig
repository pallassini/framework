//! Motore minimale in-process: map id → blob, C ABI per Bun FFI.
//! `custom_db_ping` → 42 (stesso spirito del vecchio flow_db).

const std = @import("std");

const max_record: usize = 16 * 1024 * 1024;

const Db = struct {
	mutex: std.Thread.Mutex = .{},
	rows: std.AutoHashMapUnmanaged(u64, []u8),
	next_id: u64,
	alloc: std.mem.Allocator,

	fn create(alloc: std.mem.Allocator) !*Db {
		const ptr = try alloc.create(Db);
		ptr.* = .{
			.rows = .{},
			.next_id = 1,
			.alloc = alloc,
		};
		return ptr;
	}

	fn destroy(self: *Db) void {
		var it = self.rows.iterator();
		while (it.next()) |kv| {
			self.alloc.free(kv.value_ptr.*);
		}
		self.rows.deinit(self.alloc);
		self.alloc.destroy(self);
	}
};

export fn custom_db_ping() i32 {
	return 42;
}

/// Crea un database in-memory. Ritorna handle oppure null.
export fn custom_db_create() ?*anyopaque {
	const db = Db.create(std.heap.c_allocator) catch return null;
	return @ptrCast(db);
}

export fn custom_db_destroy(db: ?*anyopaque) void {
	if (db == null) return;
	const d: *Db = @ptrCast(@alignCast(db.?));
	d.destroy();
}

/// Inserisce `data[0..len]`, ritorna id ≥ 1 o negativo su errore.
export fn custom_db_put(db: ?*anyopaque, data: [*]const u8, len: usize) i64 {
	if (db == null or len == 0 or len > max_record) return -1;
	const d: *Db = @ptrCast(@alignCast(db.?));
	d.mutex.lock();
	defer d.mutex.unlock();

	const id = d.next_id;
	d.next_id +%= 1;

	const copy = d.alloc.alloc(u8, len) catch return -2;
	@memcpy(copy, data[0..len]);
	d.rows.put(d.alloc, id, copy) catch {
		d.alloc.free(copy);
		return -3;
	};
	return @intCast(id);
}

/// Lunghezza record o -1 se assente.
export fn custom_db_get_len(db: ?*anyopaque, id: i64) i32 {
	if (db == null or id <= 0) return -1;
	const d: *Db = @ptrCast(@alignCast(db.?));
	d.mutex.lock();
	defer d.mutex.unlock();
	const u_id: u64 = @intCast(id);
	const v = d.rows.get(u_id) orelse return -1;
	if (v.len > std.math.maxInt(i32)) return -1;
	return @intCast(v.len);
}

/// Copia fino a `out_max` byte in `out`. Ritorna byte scritti o -1.
export fn custom_db_get(db: ?*anyopaque, id: i64, out: [*]u8, out_max: usize) i32 {
	if (db == null or id <= 0) return -1;
	const d: *Db = @ptrCast(@alignCast(db.?));
	d.mutex.lock();
	defer d.mutex.unlock();
	const u_id: u64 = @intCast(id);
	const v = d.rows.get(u_id) orelse return -1;
	const n = @min(v.len, out_max);
	@memcpy(out[0..n], v[0..n]);
	return @intCast(n);
}
