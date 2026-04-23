import { server, state } from "client";
import AdminMenu from "./components/menu";

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
      <AdminMenu />

      <div s={{ des: "p-4 gap-3 fd-col" }}>
        <div
          on={{ click: callTest }}
          s={{
            des: "px-4 py-2 br-6 bg-#2266ee c-white cur-pointer w-fit-content",
          }}
        >
          {loading() ? "..." : "Call server.test()"}
        </div>

        <div show={result() != null}>
          <pre s={{ des: "p-3 bg-#111 c-#0f0 fs-12 br-6" }}>
            {JSON.stringify(result(), null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}
