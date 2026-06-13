/**
 * Supabase-compatible shim روی postgres driver.
 * همان interface را (db.from(...).select(...).eq(...)) پیاده‌سازی می‌کند
 * اما زیرش مستقیم با PostgreSQL حرف می‌زند — بدونِ هیچ وابستگی به Supabase cloud.
 *
 * Pattern‌های پشتیبانی‌شده:
 *   SELECT / INSERT / UPDATE / DELETE / UPSERT
 *   .eq / .neq / .gte / .lte / .in
 *   .order / .limit / .range
 *   .single / .maybeSingle
 *   .select("*", { count: "exact", head: true })  → فقط count
 *   .select("*", { count: "exact" })              → count + data
 *   .rpc(name, params)                             → stored procedure
 */

import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type Row = Record<string, unknown>;
type SbError = { message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SbResult<T = any> = {
  data: T | null;
  error: SbError | null;
  count?: number;
};

// ── identifier validation & quoting ──────────────────────────────────────────

function ident(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return `"${name}"`;
}

function colList(colStr: string): string {
  if (colStr === "*") return "*";
  return colStr
    .split(",")
    .map((c) => ident(c.trim()))
    .join(", ");
}

function stripUndefined(obj: Row): Row {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── QueryBuilder ─────────────────────────────────────────────────────────────

type Op = "select" | "insert" | "update" | "delete" | "upsert";
type Cond = { col: string; op: string; val: unknown };
type Order = { col: string; asc: boolean };
type CountOpts = { count?: string; head?: boolean };

class QueryBuilder {
  private _sql: Sql;
  private _table: string;
  private _op: Op | null = null;
  private _selectCols = "*";
  private _countOpts?: CountOpts;
  private _returning?: string;
  private _data: Row | Row[] | null = null;
  private _conflict?: string;
  private _conds: Cond[] = [];
  private _orders: Order[] = [];
  private _limit?: number;
  private _offset?: number;
  private _term?: "single" | "maybeSingle";
  private _promise?: Promise<SbResult>;

  constructor(sql: Sql, table: string) {
    this._sql = sql;
    this._table = table;
  }

  // ── operation setters ──────────────────────────────────────────────────────

  select(columns = "*", opts?: CountOpts) {
    if (this._op === null) {
      this._op = "select";
      this._selectCols = columns;
      this._countOpts = opts;
    } else {
      // called after insert/update/upsert → sets RETURNING columns
      this._returning = columns;
    }
    return this;
  }

  insert(data: Row | Row[]) {
    this._op = "insert";
    this._data = data;
    return this;
  }

  update(data: Row) {
    this._op = "update";
    this._data = data;
    return this;
  }

  delete() {
    this._op = "delete";
    return this;
  }

  upsert(data: Row | Row[], opts: { onConflict: string }) {
    this._op = "upsert";
    this._data = data;
    this._conflict = opts.onConflict;
    return this;
  }

  // ── filter / order / pagination ───────────────────────────────────────────

  eq(col: string, val: unknown) {
    this._conds.push({ col, op: "=", val });
    return this;
  }

  neq(col: string, val: unknown) {
    this._conds.push({ col, op: "!=", val });
    return this;
  }

  gte(col: string, val: unknown) {
    this._conds.push({ col, op: ">=", val });
    return this;
  }

  gt(col: string, val: unknown) {
    this._conds.push({ col, op: ">", val });
    return this;
  }

  lt(col: string, val: unknown) {
    this._conds.push({ col, op: "<", val });
    return this;
  }

  lte(col: string, val: unknown) {
    this._conds.push({ col, op: "<=", val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._conds.push({ col, op: "IN", val: vals });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  range(from: number, to: number) {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  // ── terminators ───────────────────────────────────────────────────────────

  single(): Promise<SbResult> {
    this._term = "single";
    if (this._limit == null) this._limit = 1;
    return this._run();
  }

  maybeSingle(): Promise<SbResult> {
    this._term = "maybeSingle";
    if (this._limit == null) this._limit = 1;
    return this._run();
  }

  // thenable — allows `await queryBuilder` without calling .single()/.maybeSingle()
  then<R1 = SbResult, R2 = never>(
    resolve?: ((v: SbResult) => R1 | PromiseLike<R1>) | null,
    reject?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    if (!this._promise) this._promise = this._run();
    return this._promise.then(resolve, reject) as Promise<R1 | R2>;
  }

  // ── query execution ───────────────────────────────────────────────────────

  private async _run(): Promise<SbResult> {
    const params: unknown[] = [];
    let idx = 1;
    const p = (v: unknown): string => {
      params.push(v);
      return `$${idx++}`;
    };

    try {
      const t = ident(this._table);

      // WHERE clause (built before operation-specific code; indices are stable)
      let where = "";
      if (this._conds.length > 0) {
        const parts = this._conds.map((c) => {
          if (c.op === "IN") {
            const arr = c.val as unknown[];
            if (arr.length === 0) return "1=0";
            return `${ident(c.col)} IN (${arr.map((v) => p(v)).join(", ")})`;
          }
          return `${ident(c.col)} ${c.op} ${p(c.val)}`;
        });
        where = `WHERE ${parts.join(" AND ")}`;
      }

      const orderSql = this._orders.length > 0
        ? `ORDER BY ${this._orders.map((o) => `${ident(o.col)} ${o.asc ? "ASC" : "DESC"}`).join(", ")}`
        : "";
      const limitSql  = this._limit  != null ? `LIMIT ${this._limit}`  : "";
      const offsetSql = this._offset != null ? `OFFSET ${this._offset}` : "";

      // ── SELECT ─────────────────────────────────────────────────────────────
      if (this._op === "select") {
        const headCount = this._countOpts?.head === true && this._countOpts.count === "exact";
        const withCount = !headCount && this._countOpts?.count === "exact";

        if (headCount) {
          const q = `SELECT COUNT(*) FROM ${t} ${where}`;
          const rows = await this._sql.unsafe(q, params as any[]);
          return { data: null, error: null, count: Number((rows as any)[0]?.count ?? 0) };
        }

        const cStr = colList(this._selectCols);

        if (withCount) {
          const countParams = [...params];
          const [countRows, dataRows] = await Promise.all([
            this._sql.unsafe(`SELECT COUNT(*) FROM ${t} ${where}`, countParams as any[]),
            this._sql.unsafe(
              `SELECT ${cStr} FROM ${t} ${where} ${orderSql} ${limitSql} ${offsetSql}`,
              params as any[]
            ),
          ]);
          return {
            data: dataRows as Row[],
            error: null,
            count: Number((countRows as any)[0]?.count ?? 0),
          };
        }

        const q = `SELECT ${cStr} FROM ${t} ${where} ${orderSql} ${limitSql} ${offsetSql}`;
        const rows = await this._sql.unsafe(q, params as any[]);
        return this._finish(rows as Row[]);
      }

      // ── INSERT ─────────────────────────────────────────────────────────────
      if (this._op === "insert") {
        const arr = (Array.isArray(this._data) ? this._data : [this._data!]).map(stripUndefined);
        const keys = Object.keys(arr[0]);
        const cStr = keys.map(ident).join(", ");
        const vStr = arr
          .map((row) => `(${Object.values(row).map((v) => p(v)).join(", ")})`)
          .join(", ");
        const ret = this._returning ? `RETURNING ${colList(this._returning)}` : "";
        const q = `INSERT INTO ${t} (${cStr}) VALUES ${vStr} ${ret}`;
        const rows = await this._sql.unsafe(q, params as any[]);
        return this._finishMutate(rows as Row[]);
      }

      // ── UPDATE ─────────────────────────────────────────────────────────────
      if (this._op === "update") {
        const data = stripUndefined(this._data as Row);
        const setSql = Object.entries(data)
          .map(([k, v]) => `${ident(k)} = ${p(v)}`)
          .join(", ");
        const ret = this._returning ? `RETURNING ${colList(this._returning)}` : "";
        const q = `UPDATE ${t} SET ${setSql} ${where} ${ret}`;
        const rows = await this._sql.unsafe(q, params as any[]);
        return this._finishMutate(rows as Row[]);
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (this._op === "delete") {
        await this._sql.unsafe(`DELETE FROM ${t} ${where}`, params as any[]);
        return { data: null, error: null };
      }

      // ── UPSERT ─────────────────────────────────────────────────────────────
      if (this._op === "upsert") {
        const arr = (Array.isArray(this._data) ? this._data : [this._data!]).map(stripUndefined);
        const keys = Object.keys(arr[0]);
        const cStr = keys.map(ident).join(", ");
        const vStr = arr
          .map((row) => `(${Object.values(row).map((v) => p(v)).join(", ")})`)
          .join(", ");
        const conflictKeys = this._conflict!.split(",").map((c) => c.trim());
        const conflictSql  = conflictKeys.map(ident).join(", ");
        const updateKeys   = keys.filter((k) => !conflictKeys.includes(k));
        const doClause = updateKeys.length > 0
          ? `DO UPDATE SET ${updateKeys.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(", ")}`
          : "DO NOTHING";
        const ret = this._returning ? `RETURNING ${colList(this._returning)}` : "";
        const q = `INSERT INTO ${t} (${cStr}) VALUES ${vStr} ON CONFLICT (${conflictSql}) ${doClause} ${ret}`;
        const rows = await this._sql.unsafe(q, params as any[]);
        return this._finishMutate(rows as Row[]);
      }

      return { data: null, error: { message: "Unknown operation" } };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }

  private _finish(rows: Row[]): SbResult {
    if (this._term === "single") {
      if (rows.length === 0) return { data: null, error: { message: "PGRST116: 0 rows" } };
      return { data: rows[0], error: null };
    }
    if (this._term === "maybeSingle") {
      return { data: rows.length > 0 ? rows[0] : null, error: null };
    }
    return { data: rows, error: null };
  }

  private _finishMutate(rows: Row[]): SbResult {
    if (!this._returning) return { data: null, error: null };
    return this._finish(rows);
  }
}

// ── PgClient ──────────────────────────────────────────────────────────────────

export class PgClient {
  private _sql: Sql;

  constructor(sql: Sql) {
    this._sql = sql;
  }

  from(table: string): QueryBuilder {
    return new QueryBuilder(this._sql, table);
  }

  /**
   * کوئریِ خام و پارامتری برای تجمیع‌هایی که query-builder پوشش نمی‌دهد
   * (GROUP BY، SUM، FILTER، JOIN، ویوها). فقط سمتِ سرور و با SQLِ کنترل‌شده
   * در کد استفاده شود — هرگز با ورودیِ کاربر concat نکن؛ پارامترها را $1,$2,... بفرست.
   */
  async query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    return (await this._sql.unsafe(text, params as any[])) as T[];
  }

  async rpc(name: string, params: Record<string, unknown>): Promise<SbResult> {
    try {
      const vals = Object.values(params);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const q = `SELECT * FROM public.${ident(name)}(${placeholders})`;
      const rows = (await this._sql.unsafe(q, vals as any[])) as Row[];
      if (rows.length === 1) {
        const keys = Object.keys(rows[0]);
        // stored procedure با یک مقدارِ اسکالر
        if (keys.length === 1) return { data: rows[0][keys[0]], error: null };
      }
      return { data: rows[0] ?? null, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
}

// ── factory ───────────────────────────────────────────────────────────────────

export function createPgClient(url: string): PgClient {
  // Arvan DBaaS (و خیلی از DBaaSهای داخلی) TLS را قبول نمی‌کنند و هنگامِ probeِ
  // SSL سوکت را می‌بندند. حالتِ "prefer" باعثِ یک handshakeِ ناموفق در هر اتصالِ
  // جدید می‌شود (~۸ برابر کندتر و زیرِ بار شکننده). پس پیش‌فرض را بدونِ SSL می‌گذاریم
  // و فقط وقتی صریحاً sslmode=require در URL باشد SSL را روشن می‌کنیم.
  const useSSL = /sslmode=require/.test(url);
  const sql = postgres(url, {
    max: 20,
    idle_timeout: 30,
    max_lifetime: 60 * 30, // اتصال‌ها را هر ۳۰ دقیقه بازیافت کن تا اتصالِ بیاتِ بسته‌شده توسطِ سرور باقی نماند
    connect_timeout: 10,
    ssl: useSSL ? "require" : false,
  });
  return new PgClient(sql);
}
