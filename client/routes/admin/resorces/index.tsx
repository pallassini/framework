import { For, server, state } from "client";
import type { Icon } from "../../../../core/client/runtime/tag/tags/icon";
import { data } from "..";
import { TimePicker } from "../_components/time-picker";
import Resource from "./resources";

// IF RESOURCE HAVE ITS OWN HOURS USE IT, OTHERWISE USE THE GLOBAL HOURS
export default function Resources() {
  const view = state("always");
  return (
    <>
      <div
        s={{
          base: "row centerx gapx-10 round-25px px-10 py-3 b-1 b-secondary w-auto mt-2 maxw-30rem scrollx font-4 text-4",
        }}
      >
        <t>SEMPRE</t>

        <For each={() => data.openingHours()?.filter((o) => o.validFrom === null)}>
          {(o) => {
            return <t>{o.startTime}</t>;
          }}
        </For>
      </div>
      {/* // ───────────────────────────────────────────────────────────────────────────────
          // GLOBAL HOURS
          // ────────────────────────────────────────────────────────────────────────────────── */}
      <div
        s={{
          des: "relative  ml-10vw b-2px b-secondary col gapy-1vh round-round px-1vw py-1vh mt-10vh mx-5vw maxw-140rem  children-centerx",
        }}
      >
        <t
          s={{
            des: "font-6 text-6 absolute -mt-2vh ml-1vw bg-background row children-center gapx-0.2vw px-0.5vw py-0.2vh round-round gapx-0.5vw",
          }}
        >
          <icon name="clock" size="3" stroke={2.5} s={{ des: " right" }} />
          ORARI
        </t>
        {/* DAYS */}
        <div s="row gapx-0.8vw mt-2vh w-100% centerx children-centerx">
          <For each={week}>
            {([day, name]) => {
              const dayHover = state(false);
              const hoursOfDay = () =>
                (data.openingHours() ?? []).filter(
                  (o) => o.resourceId == null && o.dayOfWeek === day,
                );
              const showPlus = () => dayHover() || hoursOfDay().length === 0;
              return (
                <div
                  style={{ flex: "1 1 0", minWidth: 0 }}
                  s={{
                    base: "b-1px round-round b-#2a2a2a duration-200",
                    des: "col gapy-0.3vh px-0.8vw py-1vh  maxw-16rem",
                  }}
                  hover={dayHover}
                >
                  <t s={{ des: "font-6 text-4" }}>{name}</t>
                  {/* HOURS */}
                  <div s={{ des: "col w-100% gapy-1vh mt-1vh " }}>
                    <For each={hoursOfDay}>
                      {(o) => {
                        const rowHover = state(false);
                        return (
                          <div
                            s="relative row w-100% children-centery children-centerx gapx-8px left children-left"
                            hover={rowHover}
                          >
                            <TimePicker
                              value={o.startTime}
                              onChange={(value) =>
                                server.booker.openingHourUpdate({ id: o.id, startTime: value })
                              }
                            />
                            <t s="text-2 opacity-50">–</t>
                            <TimePicker
                              value={o.endTime}
                              onChange={(value) =>
                                server.booker.openingHourUpdate({ id: o.id, endTime: value })
                              }
                            />
                            <icon
                              name="trash"
                              size="3"
                              show={rowHover}
                              color="#fa0000"
                              s={{ base: { "duration-150 absolute right ": true } }}
                              click={async () => {
                                await server.booker.openingHourDelete(
                                  { id: o.id },
                                  {
                                    onSuccess: () => {
                                      data((d) =>
                                        d
                                          ? {
                                              ...d,
                                              openingHours: (d.openingHours ?? []).filter(
                                                (x) => x.id !== o.id,
                                              ),
                                            }
                                          : d,
                                      );
                                    },
                                  },
                                );
                              }}
                            />
                          </div>
                        );
                      }}
                    </For>
                  </div>
                  {/* CREATE — appare in hover sul day; sempre visibile se non ci sono orari */}
                  <div
                    style={{ overflow: "hidden" }}
                    s={{
                      base: {
                        "duration-200 ease": true,
                        "maxh-10vh opacity-100 mt-2vh": showPlus,
                        "maxh-0 opacity-0 mt-0": () => !showPlus(),
                      },
                    }}
                  >
                    <div
                      s={{
                        base: "text-2",
                        des: "opacity-90 b-1px round-10px p-0.3vw cursor-pointer centerx children-center hover:(bg-secondary)",
                      }}
                      click={async () => {
                        await server.booker.openingHourCreate(
                          [{ dayOfWeek: day, startTime: "09:00:00", endTime: "18:00:00" }],
                          {
                            onSuccess: (res) => {
                              data((d) =>
                                d
                                  ? {
                                      ...d,
                                      openingHours: [
                                        ...(d.openingHours ?? []),
                                        ...res.openingHours,
                                      ],
                                    }
                                  : d,
                              );
                            },
                          },
                        );
                      }}
                    >
                      <icon name="plus" size="3" />
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      {/* // ───────────────────────────────────────────────────────────────────────────────
          // RESOURCES
          // ────────────────────────────────────────────────────────────────────────────────── */}

    <Resource />


    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// UTILS
// ───────────────────────────────────────────────────────────────────────────────

type CardProps = {
  title: string;
  icon: Icon;
  children?: unknown;
  s?: any;
  actions?: unknown;
};

function Card({ title, icon: iconName, children, s, actions }: CardProps) {
  return (
    <div
      s={{
        base: {
          "col w-100% round-round py-3 px-3 centerx bg-secondary": true,
          ...s,
        },
      }}
    >
      <div
        s={{
          des: "font-6 text-6 row px-2 round-5px  gapx-2 children-center",
        }}
      >
        <icon name={iconName} stroke={2.5} />
        <t>{title}</t>
        <div s="right">{actions}</div>
      </div>
      {children}
    </div>
  );
}

const week = [
  ["monday", "Lunedì"],
  ["tuesday", "Martedì"],
  ["wednesday", "Mercoledì"],
  ["thursday", "Giovedì"],
  ["friday", "Venerdì"],
  ["saturday", "Sabato"],
  ["sunday", "Domenica"],
] as const;
