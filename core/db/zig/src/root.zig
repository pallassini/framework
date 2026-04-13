//! fwdb — tabelle con PK + JSON, catalog (indici, FK), WAL + snapshot.
//! C ABI per Bun. Codici: 5=fk, 6=unique, 7=catalog, 8=restrict, 9=internal.

const std = @import("std");

const WalOp = enum(u8) { put = 1, del = 2 };

const OnDelete = enum { restrict, cascade };

const FkDef = struct {
	col: []u8,
	parent_table: []u8,
	parent_col: []u8,
	on_delete: OnDelete,
};

const IdxDef = struct {
	name: []u8,
	cols: [][]u8,
	unique: bool,
};

const TableSpec = struct {
	name: []u8,
	pk_col: []u8,
	indexes: []IdxDef,
	fks: []FkDef,
};

const ChildEdge = struct {
	child_table: []const u8,
	fk_col: []const u8,
	parent_table: []const u8,
	on_delete: OnDelete,
};

const IndexData = struct {
	unique: bool,
	col: []u8,
	uni: std.StringHashMapUnmanaged([]u8) = .{},
	multi: std.StringHashMapUnmanaged(std.ArrayListUnmanaged([]u8)) = .{},

	fn deinit(self: *IndexData, al: std.mem.Allocator) void {
		al.free(self.col);
		var it = self.uni.iterator();
		while (it.next()) |e| {
			al.free(e.key_ptr.*);
			al.free(e.value_ptr.*);
		}
		self.uni.deinit(al);
		var it2 = self.multi.iterator();
		while (it2.next()) |e| {
			al.free(e.key_ptr.*);
			for (e.value_ptr.items) |pk| al.free(pk);
			e.value_ptr.deinit(al);
		}
		self.multi.deinit(al);
	}
};

const Table = struct {
	spec: TableSpec,
	rows: std.StringHashMapUnmanaged([]u8) = .{},
	indexes: std.StringHashMapUnmanaged(IndexData) = .{},

	fn deinit(self: *Table, al: std.mem.Allocator) void {
		deinitSpec(&self.spec, al);
		var rit = self.rows.iterator();
		while (rit.next()) |e| {
			al.free(e.key_ptr.*);
			al.free(e.value_ptr.*);
		}
		self.rows.deinit(al);
		var iit = self.indexes.iterator();
		while (iit.next()) |e| {
			al.free(e.key_ptr.*);
			e.value_ptr.deinit(al);
		}
		self.indexes.deinit(al);
	}
};

fn deinitSpec(s: *const TableSpec, al: std.mem.Allocator) void {
	al.free(s.name);
	al.free(s.pk_col);
	for (s.indexes) |ix| {
		al.free(ix.name);
		for (ix.cols) |c| al.free(c);
		al.free(ix.cols);
	}
	al.free(s.indexes);
	for (s.fks) |fk| {
		al.free(fk.col);
		al.free(fk.parent_table);
		al.free(fk.parent_col);
	}
	al.free(s.fks);
}

const Engine = struct {
	mut: std.Thread.Mutex = .{},
	gpa: std.heap.GeneralPurposeAllocator(.{}) = .{},
	tables: std.StringHashMapUnmanaged(Table) = .{},
	data_dir: ?[]u8 = null,
	catalog_mode: bool = false,
	child_edges: std.ArrayListUnmanaged(ChildEdge) = .{},

	fn allocator(self: *Engine) std.mem.Allocator {
		return self.gpa.allocator();
	}

	fn deinit(self: *Engine) void {
		var it = self.tables.iterator();
		while (it.next()) |e| {
			e.value_ptr.deinit(self.allocator());
			self.allocator().free(e.key_ptr.*);
		}
		self.tables.deinit(self.allocator());
		self.child_edges.deinit(self.allocator());
		if (self.data_dir) |d| self.allocator().free(d);
		_ = self.gpa.deinit();
	}
};

const Scan = struct {
	rows: []RowSnap,
	idx: usize = 0,
	const RowSnap = struct { pk: []u8, json: []u8 };
	fn deinit(self: *Scan, al: std.mem.Allocator) void {
		for (self.rows) |r| {
			al.free(r.pk);
			al.free(r.json);
		}
		al.free(self.rows);
	}
};

fn sl(p: [*]const u8, len: usize) []const u8 {
	return p[0..len];
}

fn dup(al: std.mem.Allocator, s: []const u8) ![]u8 {
	const o = try al.alloc(u8, s.len);
	@memcpy(o, s);
	return o;
}

fn jsonFieldKey(al: std.mem.Allocator, json: []const u8, field: []const u8) !?[]u8 {
	var p = std.json.parseFromSlice(std.json.Value, al, json, .{}) catch return null;
	defer p.deinit();
	const o = p.value.object.get(field) orelse return null;
	switch (o) {
		.string => |s| return try al.dupe(u8, s),
		.integer => |i| return try std.fmt.allocPrint(al, "{d}", .{i}),
		.float => |f| return try std.fmt.allocPrint(al, "{d}", .{f}),
		.null => return null,
		else => return null,
	}
}

fn pkFromJson(al: std.mem.Allocator, json: []const u8, pk_col: []const u8) !?[]u8 {
	return try jsonFieldKey(al, json, pk_col);
}

fn indexAdd(table: *Table, al: std.mem.Allocator, iname: []const u8, col: []const u8, unique: bool, val: []const u8, pk: []const u8) !void {
	const gop = try table.indexes.getOrPut(al, try dup(al, iname));
	if (!gop.found_existing) {
		gop.value_ptr.* = .{ .unique = unique, .col = try dup(al, col) };
	}
	const id = gop.value_ptr;
	std.debug.assert(std.mem.eql(u8, id.col, col));
	if (id.unique) {
		const v_owned = try dup(al, val);
		errdefer al.free(v_owned);
		if (id.uni.get(v_owned)) |oldpk| {
			if (!std.mem.eql(u8, oldpk, pk)) {
				return error.UniqueViol;
			}
			return;
		}
		const pk_owned = try dup(al, pk);
		errdefer al.free(pk_owned);
		try id.uni.put(al, v_owned, pk_owned);
	} else {
		if (id.multi.getPtr(val)) |list_ptr| {
			const pk_owned = try dup(al, pk);
			try list_ptr.append(al, pk_owned);
		} else {
			const v_owned = try dup(al, val);
			errdefer al.free(v_owned);
			var list = std.ArrayListUnmanaged([]u8){};
			const pk_owned = try dup(al, pk);
			errdefer {
				al.free(pk_owned);
				list.deinit(al);
			}
			try list.append(al, pk_owned);
			try id.multi.put(al, v_owned, list);
		}
	}
}

fn indexRemove(table: *Table, al: std.mem.Allocator, iname: []const u8, col: []const u8, val: []const u8, pk: []const u8) !void {
	const id = table.indexes.getPtr(iname) orelse return;
	if (!std.mem.eql(u8, id.col, col)) return;
	if (id.unique) {
		if (id.uni.fetchRemove(val)) |kv| {
			al.free(kv.key);
			al.free(kv.value);
		}
	} else {
		const g = id.multi.getPtr(val) orelse return;
		var i: usize = 0;
		while (i < g.items.len) : (i += 1) {
			if (std.mem.eql(u8, g.items[i], pk)) {
				al.free(g.items[i]);
				_ = g.swapRemove(i);
				break;
			}
		}
		if (g.items.len == 0) {
			if (id.multi.fetchRemove(val)) |kv| {
				al.free(kv.key);
				var list = kv.value;
				list.deinit(al);
			}
		}
	}
}

fn indexPtrByCol(t: *Table, col: []const u8) ?*IndexData {
	var it = t.indexes.iterator();
	while (it.next()) |ent| {
		if (std.mem.eql(u8, ent.value_ptr.col, col)) return ent.value_ptr;
	}
	return null;
}

fn rebuildChildEdges(e: *Engine) !void {
	e.child_edges.clearRetainingCapacity();
	const al = e.allocator();
	var it = e.tables.iterator();
	while (it.next()) |ent| {
		const tbl = ent.value_ptr;
		for (tbl.spec.fks) |fk| {
			try e.child_edges.append(al, .{
				.child_table = tbl.spec.name,
				.fk_col = fk.col,
				.parent_table = fk.parent_table,
.on_delete = fk.on_delete,
			});
		}
	}
}

fn appendWal(e: *Engine, op: WalOp, tname: []const u8, pk: []const u8, json: ?[]const u8) !void {
	const dd = e.data_dir orelse return;
	const al = e.allocator();
	const path_buf = try std.fs.path.join(al, &.{ dd, "wal.log" });
	defer al.free(path_buf);
	const f = try std.fs.cwd().createFile(path_buf, .{ .read = true, .truncate = false });
	defer f.close();
	try f.seekFromEnd(0);
	var buf = std.ArrayListUnmanaged(u8){};
	defer buf.deinit(al);
	const wr = buf.writer(al);
	try wr.writeInt(u8, @intFromEnum(op), .little);
	try wr.writeInt(u32, @intCast(tname.len), .little);
	try wr.writeAll(tname);
	try wr.writeInt(u32, @intCast(pk.len), .little);
	try wr.writeAll(pk);
	if (op == .put) {
		const j = json orelse return error.WalJson;
		try wr.writeInt(u32, @intCast(j.len), .little);
		try wr.writeAll(j);
	}
	try f.writeAll(buf.items);
	try f.sync();
}

fn saveSnapshot(e: *Engine) !void {
	const dd = e.data_dir orelse return;
	const al = e.allocator();
	const path_buf = try std.fs.path.join(al, &.{ dd, "snapshot.bin" });
	defer al.free(path_buf);

	var names = std.ArrayListUnmanaged([]const u8){};
	defer {
		for (names.items) |n| al.free(@constCast(n));
		names.deinit(al);
	}
	var tit = e.tables.iterator();
	while (tit.next()) |ent| try names.append(al, try dup(al, ent.key_ptr.*));
	std.mem.sort([]const u8, names.items, {}, struct {
		fn lt(_: void, a: []const u8, b: []const u8) bool {
			return std.mem.order(u8, a, b) == .lt;
		}
	}.lt);

	var buf = std.ArrayListUnmanaged(u8){};
	defer buf.deinit(al);
	const wr = buf.writer(al);
	try wr.writeAll("FWDBSNP\x01");
	try wr.writeInt(u32, @intCast(names.items.len), .little);
	for (names.items) |tname| {
		try wr.writeInt(u32, @intCast(tname.len), .little);
		try wr.writeAll(tname);
		const tbl = e.tables.get(tname) orelse continue;
		try wr.writeInt(u64, @intCast(tbl.rows.count()), .little);
		var rit = tbl.rows.iterator();
		while (rit.next()) |row| {
			try wr.writeInt(u32, @intCast(row.key_ptr.len), .little);
			try wr.writeAll(row.key_ptr.*);
			try wr.writeInt(u32, @intCast(row.value_ptr.len), .little);
			try wr.writeAll(row.value_ptr.*);
		}
	}
	const f = try std.fs.cwd().createFile(path_buf, .{ .truncate = true });
	defer f.close();
	try f.writeAll(buf.items);
	try f.sync();
}

fn truncateWal(e: *Engine) !void {
	const dd = e.data_dir orelse return;
	const al = e.allocator();
	const path_buf = try std.fs.path.join(al, &.{ dd, "wal.log" });
	defer al.free(path_buf);
	const f = try std.fs.cwd().createFile(path_buf, .{ .truncate = true });
	defer f.close();
	try f.sync();
}

fn ingestRow(e: *Engine, tname: []const u8, pk: []const u8, json: []const u8, replace: bool, skip_wal: bool) !void {
	const al = e.allocator();
	const tbl = e.tables.getPtr(tname) orelse return error.NoTable;
	if (tbl.spec.fks.len > 0) {
		for (tbl.spec.fks) |fk| {
			const refv = (try jsonFieldKey(al, json, fk.col)) orelse continue;
			defer al.free(refv);
			const pt = e.tables.get(fk.parent_table) orelse return error.NoTable;
			if (pt.rows.get(refv) == null) return error.FkViol;
		}
	}
	if (tbl.rows.getEntry(pk)) |ent| {
		if (!replace) return error.DupKey;
		const old_pk_opt = try pkFromJson(al, ent.value_ptr.*, tbl.spec.pk_col);
		if (old_pk_opt) |old_pk| {
			defer al.free(old_pk);
			for (tbl.spec.indexes) |ix| {
				if (ix.cols.len != 1) continue;
				if (try jsonFieldKey(al, ent.value_ptr.*, ix.cols[0])) |ov| {
					defer al.free(ov);
					try indexRemove(tbl, al, ix.name, ix.cols[0], ov, pk);
				}
			}
		}
		al.free(ent.value_ptr.*);
		const json_owned = try dup(al, json);
		ent.value_ptr.* = json_owned;
	} else {
		const pk_owned = try dup(al, pk);
		errdefer al.free(pk_owned);
		const json_owned = try dup(al, json);
		try tbl.rows.put(al, pk_owned, json_owned);
	}
	for (tbl.spec.indexes) |ix| {
		if (ix.cols.len != 1) continue;
		const v = (try jsonFieldKey(al, json, ix.cols[0])) orelse continue;
		defer al.free(v);
		indexAdd(tbl, al, ix.name, ix.cols[0], ix.unique, v, pk) catch |err| {
			if (err == error.UniqueViol) return error.UniqueViol;
			return err;
		};
	}
	if (!skip_wal) try appendWal(e, .put, tname, pk, json);
}

fn ingestDelete(e: *Engine, tname: []const u8, pk: []const u8, skip_wal: bool) !void {
	const al = e.allocator();
	const tbl = e.tables.getPtr(tname) orelse return error.NoTable;
	const json = tbl.rows.get(pk) orelse return;
	if (try pkFromJson(al, json, tbl.spec.pk_col)) |epk| {
		defer al.free(epk);
		if (!std.mem.eql(u8, epk, pk)) {}
	}
	for (tbl.spec.indexes) |ix| {
		if (ix.cols.len != 1) continue;
		if (try jsonFieldKey(al, json, ix.cols[0])) |ov| {
			defer al.free(ov);
			try indexRemove(tbl, al, ix.name, ix.cols[0], ov, pk);
		}
	}
	_ = tbl.rows.fetchRemove(pk) orelse return;
	al.free(json);
	if (!skip_wal) try appendWal(e, .del, tname, pk, null);
}

fn deleteCascade(e: *Engine, tname: []const u8, pk: []const u8) anyerror!void {
	const al = e.allocator();
	for (e.child_edges.items) |edge| {
		if (!std.mem.eql(u8, edge.parent_table, tname)) continue;
		if (edge.on_delete != .cascade) continue;
		const child_t = e.tables.getPtr(edge.child_table) orelse continue;
		const id = indexPtrByCol(child_t, edge.fk_col) orelse continue;
		if (id.unique) {
			if (id.uni.get(pk)) |child_pk| {
				const cpy = try dup(al, child_pk);
				try deleteCascade(e, edge.child_table, cpy);
				try ingestDelete(e, edge.child_table, cpy, false);
				al.free(cpy);
			}
		} else if (id.multi.get(pk)) |list| {
			var batch = std.ArrayListUnmanaged([]u8){};
			defer {
				for (batch.items) |p| al.free(p);
				batch.deinit(al);
			}
			for (list.items) |cpk| try batch.append(al, try dup(al, cpk));
			for (batch.items) |cpy| {
				try deleteCascade(e, edge.child_table, cpy);
				try ingestDelete(e, edge.child_table, cpy, false);
			}
		}
	}
	try ingestDelete(e, tname, pk, false);
}

fn restrictCheck(e: *Engine, tname: []const u8, pk: []const u8) !void {
	for (e.child_edges.items) |edge| {
		if (!std.mem.eql(u8, edge.parent_table, tname)) continue;
		if (edge.on_delete != .restrict) continue;
		const child_t = e.tables.getPtr(edge.child_table) orelse continue;
		const id = indexPtrByCol(child_t, edge.fk_col) orelse continue;
		if (id.unique) {
			if (id.uni.get(pk) != null) return error.RestrictViol;
		} else if (id.multi.get(pk)) |list| {
			if (list.items.len > 0) return error.RestrictViol;
		}
	}
}

fn jsonStr(v: std.json.Value) ?[]const u8 {
	return switch (v) {
		.string => |s| s,
		else => null,
	};
}

fn loadCatalogFile(e: *Engine, json: []const u8) !void {
	const al = e.allocator();
	var p = try std.json.parseFromSlice(std.json.Value, al, json, .{});
	defer p.deinit();
	const root = p.value.object.get("tables") orelse return error.BadCatalog;
	const to = root.object;
	var it = to.iterator();
	while (it.next()) |kv| {
		const tname_src = kv.key_ptr.*;
		const tv = kv.value_ptr.*;
		const obj = tv.object;
		const pkv = obj.get("pk") orelse return error.BadCatalog;
		const pk_col = switch (pkv) {
			.string => |s| try dup(al, s),
			else => return error.BadCatalog,
		};
		var idx_list = std.ArrayListUnmanaged(IdxDef){};
		if (obj.get("indexes")) |ixn| {
			const arr = ixn.array;
			for (arr.items) |item| {
				const io = item.object;
				const iname = jsonStr(io.get("name") orelse return error.BadCatalog) orelse return error.BadCatalog;
				const uniq: bool = switch (io.get("unique") orelse std.json.Value{ .bool = false }) {
					.bool => |b| b,
					else => false,
				};
				const cols_a = (io.get("columns") orelse return error.BadCatalog).array;
				var cols = try al.alloc([]u8, cols_a.items.len);
				for (cols_a.items, 0..) |citem, i| {
					const cs = jsonStr(citem) orelse return error.BadCatalog;
					cols[i] = try dup(al, cs);
				}
				try idx_list.append(al, .{ .name = try dup(al, iname), .cols = cols, .unique = uniq });
			}
		}
		var fk_list = std.ArrayListUnmanaged(FkDef){};
		if (obj.get("foreignKeys")) |fkn| {
			for (fkn.array.items) |fkitem| {
				const fo = fkitem.object;
				const cols_a = (fo.get("columns") orelse return error.BadCatalog).array;
				if (cols_a.items.len != 1) return error.BadCatalog;
				const cref = (fo.get("references") orelse return error.BadCatalog).object;
				const pt = jsonStr(cref.get("table") orelse return error.BadCatalog) orelse return error.BadCatalog;
				const pc_a = (cref.get("columns") orelse return error.BadCatalog).array;
				if (pc_a.items.len != 1) return error.BadCatalog;
				const cc0 = jsonStr(cols_a.items[0]) orelse return error.BadCatalog;
				const pc0 = jsonStr(pc_a.items[0]) orelse return error.BadCatalog;
				const odv = fo.get("onDelete");
				const od: []const u8 = if (odv) |ov| (jsonStr(ov) orelse "restrict") else "restrict";
				const ond: OnDelete = if (std.mem.eql(u8, od, "cascade")) .cascade else .restrict;
				try fk_list.append(al, .{
					.col = try dup(al, cc0),
					.parent_table = try dup(al, pt),
					.parent_col = try dup(al, pc0),
					.on_delete = ond,
				});
			}
		}
		const spec = TableSpec{
			.name = try dup(al, tname_src),
			.pk_col = pk_col,
			.indexes = try idx_list.toOwnedSlice(al),
			.fks = try fk_list.toOwnedSlice(al),
		};
		const name_owned = try dup(al, tname_src);
		const gop = try e.tables.getOrPut(al, name_owned);
		if (gop.found_existing) {
			al.free(name_owned);
			deinitSpec(&spec, al);
			continue;
		}
		gop.value_ptr.* = .{ .spec = spec };
		for (gop.value_ptr.spec.indexes) |ix| {
			const ig = try gop.value_ptr.indexes.getOrPut(al, try dup(al, ix.name));
			if (!ig.found_existing) {
				ig.value_ptr.* = .{ .unique = ix.unique, .col = try dup(al, ix.cols[0]) };
			}
		}
	}
	e.catalog_mode = true;
	try rebuildChildEdges(e);
}

fn loadSnapshotFile(e: *Engine) !void {
	const dd = e.data_dir orelse return;
	const al = e.allocator();
	const path_buf = try std.fs.path.join(al, &.{ dd, "snapshot.bin" });
	defer al.free(path_buf);
	const f = std.fs.cwd().openFile(path_buf, .{}) catch return;
	defer f.close();
	const data = try f.readToEndAlloc(al, 1 << 29);
	defer al.free(data);
	var pos: usize = 0;
	if (data.len < pos + 8) return;
	if (!std.mem.eql(u8, data[pos..][0..8], "FWDBSNP\x01")) return;
	pos += 8;
	const ntbl = std.mem.readInt(u32, data[pos..][0..4], .little);
	pos += 4;
	var ti: u32 = 0;
	while (ti < ntbl) : (ti += 1) {
		if (data.len < pos + 4) return;
		const tlen = std.mem.readInt(u32, data[pos..][0..4], .little);
		pos += 4;
		if (data.len < pos + tlen) return;
		const tname = data[pos..][0..tlen];
		pos += tlen;
		if (data.len < pos + 8) return;
		const nrows = std.mem.readInt(u64, data[pos..][0..8], .little);
		pos += 8;
		var ri: u64 = 0;
		while (ri < nrows) : (ri += 1) {
			if (data.len < pos + 4) return;
			const pklen = std.mem.readInt(u32, data[pos..][0..4], .little);
			pos += 4;
			if (data.len < pos + pklen) return;
			const pk = try al.alloc(u8, pklen);
			@memcpy(pk, data[pos..][0..pklen]);
			pos += pklen;
			if (data.len < pos + 4) return;
			const jlen = std.mem.readInt(u32, data[pos..][0..4], .little);
			pos += 4;
			if (data.len < pos + jlen) return;
			const jb = try al.alloc(u8, jlen);
			@memcpy(jb, data[pos..][0..jlen]);
			pos += jlen;
			ingestRow(e, tname, pk, jb, true, true) catch {
				al.free(pk);
				al.free(jb);
				continue;
			};
			al.free(pk);
			al.free(jb);
		}
	}
}

fn replayWalFile(e: *Engine) !void {
	const dd = e.data_dir orelse return;
	const al = e.allocator();
	const path_buf = try std.fs.path.join(al, &.{ dd, "wal.log" });
	defer al.free(path_buf);
	const f = std.fs.cwd().openFile(path_buf, .{}) catch return;
	defer f.close();
	const data = try f.readToEndAlloc(al, 1 << 29);
	defer al.free(data);
	var pos: usize = 0;
	while (pos < data.len) {
		if (data.len < pos + 1) return;
		const opb = data[pos];
		pos += 1;
		const op: WalOp = @enumFromInt(opb);
		if (data.len < pos + 4) return;
		const tlen = std.mem.readInt(u32, data[pos..][0..4], .little);
		pos += 4;
		if (data.len < pos + tlen) return;
		const tname = data[pos..][0..tlen];
		pos += tlen;
		if (data.len < pos + 4) return;
		const pklen = std.mem.readInt(u32, data[pos..][0..4], .little);
		pos += 4;
		if (data.len < pos + pklen) return;
		const pk = data[pos..][0..pklen];
		pos += pklen;
		switch (op) {
			.put => {
				if (data.len < pos + 4) return;
				const jlen = std.mem.readInt(u32, data[pos..][0..4], .little);
				pos += 4;
				if (data.len < pos + jlen) return;
				const jb = data[pos..][0..jlen];
				pos += jlen;
				try ingestRow(e, tname, pk, jb, true, true);
			},
			.del => try ingestDelete(e, tname, pk, true),
		}
	}
}

export fn fwdb_engine_create() ?*Engine {
	const e = std.heap.c_allocator.create(Engine) catch return null;
	e.* = .{};
	return e;
}

export fn fwdb_engine_open(dir_ptr: ?[*]const u8, dir_len: usize) ?*Engine {
	const dp = dir_ptr orelse return null;
	if (dir_len == 0) return null;
	const dir = sl(dp, dir_len);
	const e = std.heap.c_allocator.create(Engine) catch return null;
	e.* = .{};
	const al = e.allocator();
	e.data_dir = dup(al, dir) catch {
		std.heap.c_allocator.destroy(e);
		return null;
	};
	std.fs.cwd().makePath(e.data_dir.?) catch {};
	const cat_path_buf = std.fs.path.join(al, &.{ e.data_dir.?, "catalog.json" }) catch {
		e.deinit();
		std.heap.c_allocator.destroy(e);
		return null;
	};
	defer al.free(cat_path_buf);
	const cat_file = std.fs.cwd().openFile(cat_path_buf, .{}) catch null;
	if (cat_file) |cf| {
		defer cf.close();
		const json = cf.readToEndAlloc(al, 1 << 26) catch {
			e.deinit();
			std.heap.c_allocator.destroy(e);
			return null;
		};
		defer al.free(json);
		loadCatalogFile(e, json) catch {
			e.deinit();
			std.heap.c_allocator.destroy(e);
			return null;
		};
	}
	loadSnapshotFile(e) catch {};
	replayWalFile(e) catch {};
	return e;
}

export fn fwdb_engine_destroy(engine: ?*Engine) void {
	if (engine) |e| {
		e.deinit();
		std.heap.c_allocator.destroy(e);
	}
}

export fn fwdb_checkpoint(engine: ?*Engine) i32 {
	const e = engine orelse return 4;
	e.mut.lock();
	defer e.mut.unlock();
	saveSnapshot(e) catch return 9;
	truncateWal(e) catch return 9;
	return 0;
}

export fn fwdb_table_ensure(engine: ?*Engine, name_ptr: ?[*]const u8, name_len: usize) i32 {
	const e = engine orelse return 4;
	const np = name_ptr orelse return 4;
	if (name_len == 0) return 4;
	const name = sl(np, name_len);
	e.mut.lock();
	defer e.mut.unlock();
	if (e.catalog_mode) {
		return if (e.tables.contains(name)) 0 else 2;
	}
	const al = e.allocator();
	if (e.tables.get(name) != null) return 0;
	const name_owned = dup(al, name) catch return 1;
	const gop = e.tables.getOrPut(al, name_owned) catch {
		al.free(name_owned);
		return 1;
	};
	if (gop.found_existing) {
		al.free(name_owned);
		return 0;
	}
	const spec_name = dup(al, name) catch {
_ = e.tables.fetchRemove(name);
		al.free(name_owned);
		return 1;
	};
	const spec_pk = dup(al, "id") catch {
		al.free(spec_name);
		_ = e.tables.fetchRemove(name);
		al.free(name_owned);
		return 1;
	};
	const empty_ix = al.alloc(IdxDef, 0) catch {
		al.free(spec_pk);
		al.free(spec_name);
		_ = e.tables.fetchRemove(name);
		al.free(name_owned);
		return 1;
	};
	const empty_fk = al.alloc(FkDef, 0) catch {
		al.free(empty_ix);
		al.free(spec_pk);
		al.free(spec_name);
		_ = e.tables.fetchRemove(name);
		al.free(name_owned);
		return 1;
	};
	gop.value_ptr.* = .{ .spec = .{
		.name = spec_name,
		.pk_col = spec_pk,
		.indexes = empty_ix,
		.fks = empty_fk,
	} };
	return 0;
}

export fn fwdb_row_put(
	engine: ?*Engine,
	table_ptr: ?[*]const u8,
	table_len: usize,
	pk_ptr: ?[*]const u8,
	pk_len: usize,
	json_ptr: ?[*]const u8,
	json_len: usize,
	replace: i32,
) i32 {
	const e = engine orelse return 4;
	const tp = table_ptr orelse return 4;
	const pp = pk_ptr orelse return 4;
	const jp = json_ptr orelse return 4;
	if (table_len == 0 or pk_len == 0) return 4;
	const tname = sl(tp, table_len);
	const pk = sl(pp, pk_len);
	const json = sl(jp, json_len);
	e.mut.lock();
	defer e.mut.unlock();
	const al = e.allocator();
	const tbl = e.tables.getPtr(tname) orelse return 2;
	const jpv = (pkFromJson(al, json, tbl.spec.pk_col) catch return 4) orelse return 4;
	defer al.free(jpv);
	if (!std.mem.eql(u8, jpv, pk)) return 4;
	ingestRow(e, tname, pk, json, replace != 0, false) catch |err| {
		return switch (err) {
			error.FkViol => 5,
			error.UniqueViol => 6,
			error.DupKey => 3,
			else => 9,
		};
	};
	return 0;
}

export fn fwdb_row_get(
	engine: ?*Engine,
	table_ptr: ?[*]const u8,
	table_len: usize,
	pk_ptr: ?[*]const u8,
	pk_len: usize,
	out_len: ?*usize,
) ?[*]u8 {
	const e = engine orelse return null;
	const ol = out_len orelse return null;
	const tp = table_ptr orelse return null;
	const pp = pk_ptr orelse return null;
	if (table_len == 0 or pk_len == 0) return null;
	const tname = sl(tp, table_len);
	const pk = sl(pp, pk_len);
	e.mut.lock();
	defer e.mut.unlock();
	const t = e.tables.getPtr(tname) orelse return null;
	const json = t.rows.get(pk) orelse return null;
	const buf = std.heap.c_allocator.alloc(u8, json.len) catch return null;
	@memcpy(buf, json);
	ol.* = buf.len;
	return buf.ptr;
}

export fn fwdb_row_delete(engine: ?*Engine, table_ptr: ?[*]const u8, table_len: usize, pk_ptr: ?[*]const u8, pk_len: usize) i32 {
	const e = engine orelse return 4;
	const tp = table_ptr orelse return 4;
	const pp = pk_ptr orelse return 4;
	if (table_len == 0 or pk_len == 0) return 4;
	const tname = sl(tp, table_len);
	const pk = sl(pp, pk_len);
	e.mut.lock();
	defer e.mut.unlock();
	restrictCheck(e, tname, pk) catch return 8;
	deleteCascade(e, tname, pk) catch return 9;
	return 0;
}

export fn fwdb_table_clear(engine: ?*Engine, table_ptr: ?[*]const u8, table_len: usize) i32 {
	const e = engine orelse return 4;
	const tp = table_ptr orelse return 4;
	if (table_len == 0) return 4;
	const tname = sl(tp, table_len);
	e.mut.lock();
	defer e.mut.unlock();
	const al = e.allocator();
	const t = e.tables.getPtr(tname) orelse return 2;
	var it = t.rows.iterator();
	while (it.next()) |ent| {
		al.free(ent.key_ptr.*);
		al.free(ent.value_ptr.*);
	}
	t.rows.clearAndFree(al);
	var iit = t.indexes.iterator();
	while (iit.next()) |ent| {
		al.free(ent.key_ptr.*);
		ent.value_ptr.deinit(al);
	}
	t.indexes.clearAndFree(al);
	for (t.spec.indexes) |ix| {
		if (ix.cols.len != 1) continue;
		const iname = dup(al, ix.name) catch return 9;
		const ig = t.indexes.getOrPut(al, iname) catch {
			al.free(iname);
			return 9;
		};
		if (!ig.found_existing) {
			const colo = dup(al, ix.cols[0]) catch {
				_ = t.indexes.fetchRemove(iname);
				al.free(iname);
				return 9;
			};
			ig.value_ptr.* = .{ .unique = ix.unique, .col = colo };
		} else {
			al.free(iname);
		}
	}
	return 0;
}

export fn fwdb_table_row_count(engine: ?*Engine, table_ptr: ?[*]const u8, table_len: usize) usize {
	const e = engine orelse return 0;
	const tp = table_ptr orelse return 0;
	if (table_len == 0) return 0;
	const tname = sl(tp, table_len);
	e.mut.lock();
	defer e.mut.unlock();
	const t = e.tables.getPtr(tname) orelse return 0;
	return t.rows.count();
}

export fn fwdb_scan_begin(engine: ?*Engine, table_ptr: ?[*]const u8, table_len: usize) ?*Scan {
	const e = engine orelse return null;
	const tp = table_ptr orelse return null;
	if (table_len == 0) return null;
	const tname = sl(tp, table_len);
	e.mut.lock();
	const t = e.tables.getPtr(tname) orelse {
		e.mut.unlock();
		return null;
	};
	const n = t.rows.count();
	const rows = std.heap.c_allocator.alloc(Scan.RowSnap, n) catch {
		e.mut.unlock();
		return null;
	};
	var it = t.rows.iterator();
	var i: usize = 0;
	while (it.next()) |ent| {
		const pk_copy = std.heap.c_allocator.alloc(u8, ent.key_ptr.len) catch {
			for (rows[0..i]) |r| {
				std.heap.c_allocator.free(r.pk);
				std.heap.c_allocator.free(r.json);
			}
			std.heap.c_allocator.free(rows);
			e.mut.unlock();
			return null;
		};
		@memcpy(pk_copy, ent.key_ptr.*);
		const json_copy = std.heap.c_allocator.alloc(u8, ent.value_ptr.len) catch {
			std.heap.c_allocator.free(pk_copy);
			for (rows[0..i]) |r| {
				std.heap.c_allocator.free(r.pk);
				std.heap.c_allocator.free(r.json);
			}
			std.heap.c_allocator.free(rows);
			e.mut.unlock();
			return null;
		};
		@memcpy(json_copy, ent.value_ptr.*);
		rows[i] = .{ .pk = pk_copy, .json = json_copy };
		i += 1;
	}
	e.mut.unlock();
	const scan = std.heap.c_allocator.create(Scan) catch {
		for (rows) |r| {
			std.heap.c_allocator.free(r.pk);
			std.heap.c_allocator.free(r.json);
		}
		std.heap.c_allocator.free(rows);
		return null;
	};
	scan.* = .{ .rows = rows, .idx = 0 };
	return scan;
}

export fn fwdb_scan_next_packed(scan: ?*Scan, out_len: ?*usize) ?[*]u8 {
	const s = scan orelse return null;
	const ol = out_len orelse return null;
	if (s.idx >= s.rows.len) return null;
	const r = s.rows[s.idx];
	s.idx += 1;
	const need: usize = 4 + r.pk.len + 4 + r.json.len;
	const buf = std.heap.c_allocator.alloc(u8, need) catch return null;
	var w: usize = 0;
	std.mem.writeInt(u32, buf[w..][0..4], @intCast(r.pk.len), .little);
	w += 4;
	@memcpy(buf[w .. w + r.pk.len], r.pk);
	w += r.pk.len;
	std.mem.writeInt(u32, buf[w..][0..4], @intCast(r.json.len), .little);
	w += 4;
	@memcpy(buf[w .. w + r.json.len], r.json);
	w += r.json.len;
	ol.* = w;
	return buf.ptr;
}

export fn fwdb_scan_destroy(scan: ?*Scan) void {
	if (scan) |s| {
		for (s.rows) |r| {
			std.heap.c_allocator.free(r.pk);
			std.heap.c_allocator.free(r.json);
		}
		std.heap.c_allocator.free(s.rows);
		std.heap.c_allocator.destroy(s);
	}
}

export fn fwdb_buf_free(ptr: ?[*]u8, len: usize) void {
	if (ptr) |p| std.heap.c_allocator.free(p[0..len]);
}
