import { For, server, state, watch } from "client";
import Menu from "../../_components/menu";

export default function Calendar() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-80 mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-1) ">
            <div s="b-animated(single, #fff, blur-2, power-5, spread-4, dur-15) bg-background b-1 b-#232323 relative w-100% round-round col centerx px-12 py-6 mob:(px-2 py-4)">
              {/* HEADER */}

              <Days />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAY
// ───────────────────────────────────────────────────────────────────────────────
function Days() {
  const opening = state(server.user.opening.get);
  watch(() => {
    console.log(opening());
  });
  return (
    <>
      <div s="col-4 mob:(col-2) mt-4 gap-3">
        <For
          each={[
            { label: "Lunedì", key: "monday" },
            { label: "Martedì", key: "tuesday" },
            { label: "Mercoledì", key: "wednesday" },
            { label: "Giovedì", key: "thursday" },
            { label: "Venerdì", key: "friday" },
            { label: "Sabato", key: "saturday" },
            { label: "Domenica", key: "sunday" },
          ]}
        >
          {(d) => {
            const closed = () => {
              const v = opening();
              return !(Array.isArray(v) && v.some((o) => o?.dayOfWeek === d.key));
            };
            return (
              <div
                s={{
                  base: {
                    "relative w-100% minh-25 round-round mb-3 text-background shadow(primary, blur-18, spread--6, x-0, y-10, opacity-0.72)  bg-gradient(0deg, var(--primary) 0%, var(--primary)20%, transparent 70%) px-1px pb-2px": true,
                    "shadow(error, blur-18, spread--6, x-0, y-10, opacity-0.72) bg-gradient(0deg, var(--error) 0%, transparent 70%)":
                      closed,
                  },
                }}
              >
                <div
                  s={{
                    base: {
                      "relative w-100% minh-25 round-round   text-background": true,
                      "": closed,
                    },
                  }}
                >
                  <div s=" round-16.5px">
                    <div
                      s={{
                        base: {
                          "fw-card-aurora-mesh fw-card-aurora-accent-primary": true,
                          "fw-card-aurora-mesh fw-card-aurora-accent-error": closed,
                        },
                      }}
                    />
                  </div>

                  <div s="relative col p-4">
                    <t s="text-5 font-6 text-#fff">{d.label}</t>

                    <div
                      show={closed}
                      s={{
                        base: {
                          "text-5 px-6 py-4 round-10px font-6 centerx bg-error text-background text-background row   mt-15": true,
                        },
                      }}
                    >
                      <t>Chiuso</t>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
