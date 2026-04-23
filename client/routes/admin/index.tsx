import { server, state } from "client";

type TestResult = {
  ok: boolean;
  mode?: string;
  count?: number;
  users?: unknown[];
  error?: string;
};

export default function Admin() {
  const result = state<TestResult | null>(null);
  const loading = state(false);

  async function callTest() {
    if (loading()) return;
    loading(true);
    try {
      const res = (await server.test()) as TestResult;
      result(res);
    } catch (e) {
      result({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      loading(false);
    }
  }

  return (
    <>
      <div s="col gapy-3 p-4">
        <div
          click={callTest}
          s={{
            des: "px-4 py-2 round-6px bg-#2266ee color-white cursor-pointer w-fit-content select-none",
          }}
        >
          {loading() ? "..." : "Call server.test()"}
        </div>

        <div show={() => result() != null}>
          <pre
            s="p-3 round-6px text-2 font-mono"
            style={{
              background: "#111",
              color: "#0f0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {() => JSON.stringify(result(), null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}
