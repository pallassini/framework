import { auth, Form, go, state, v } from "client";
import Input from "../../_components/input";

export default function Login() {
  const form = Form({
    size: 6,
    mode: "light",
    bg: "background",
    focusColor: "primary",
    shape: {
      email: v.email(),
      password: v.password("noError"),
    },
  });
  const error = state(false);
  return (
    <>
      <div
        s={{
          base: "center col gap-8 children-center b-3 b-secondary round-round",
          des: "w-27 mt-30 pt-6 pb-10",
          mob: "w-95% mt-30 px-3 py-8",
        }}
      >
        <div s="row center children-center gap-2 mb-3 items-center text-6 font-6">
          <icon name="shieldUser" s="text-primary" size={10} />
          <t>Accedi all'area riservata</t>
        </div>
        <div s={{ des: "w-20 gap-8 col", mob: "w-90% gap-8 col " }}>
          <Input field={form.email} placeholder="Email" click={() => error(false)} />
          <Input field={form.password} placeholder="Password" click={() => error(false)} />
        </div>
        <div
          s={{
            base: {
              "row centerx mt-2 py-3 px-4 round-12px text-3 font-6 select-none bg-#2020209d text-#727272 cursor-not-allowed": true,
              "bg-primary text-background cursor-pointer hover:(opacity-90) scale-110 px-6":
                form.valid,
              "bg-error text-background cursor-pointer hover:(opacity-90) scale-110 px-6": error,
            },
          }}
          click={async () => {
            if (!form.valid()) return;
            error(false);
            await auth.login(form.values(), {
              onSuccess: (res) => {
                if (res.user.role === "admin") {
                  go("/admin");
                } else {
                  go("/");
                }
              },

              onError: () => {
                form.errors.email("");
                form.errors.password("");
                error(true);
              },
            });
          }}
        >
          {() => (error() ? "Credenziali non valide" : form.valid() ? "Accedi" : "Compila i campi")}
        </div>
      </div>
      <div s="fixed no-events -z-1 overflow-visible lx-100% ly-100% translate-(-50%,-50%)">
        <div
          s={{
            base:
              "opacity-0 round-circle " +
              "bg-gradient(circle, #f1f1f1 0%, #676767 45%, background 70%)",
            mob: "w-110vw h-72vw blur-60px",
            tab: "w-70vw h-36vw",
            des: "w-72vw h-36vw blur-80px",
            animate: [
              {
                to: "opacity-100",
                duration: 1400,
                ease: "ease-out",
                fill: "both",
              },
              {
                keyframes: {
                  0: { opacity: 1, scale: 1 },
                  25: { opacity: 0.88, scale: 1.025 },
                  50: { opacity: 0.72, scale: 1.05 },
                  75: { opacity: 0.88, scale: 1.025 },
                  100: { opacity: 1, scale: 1 },
                },
                duration: 5200,
                ease: "inout",
                iterations: "infinite",
              },
            ],
          }}
        />
      </div>
    </>
  );
}
