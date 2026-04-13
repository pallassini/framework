import { desktop, For, persistState, server, sessionState, state } from "client";



export default function Home() {

  const prova = state<server<"ping.brooo">>();
  const prova2 = state(desktop.ping);
  
  return (
    <>
      <t
        s="text-#ffffff bg-#1a4d8c"
        click={() =>
          void server.ping.brooo({
            onSuccess: (data) => prova(data),
          })
        }
      >
        Chiama server
      </t>
      <t
        s="text-#ffffff bg-#1a6b3a"
        click={() =>
          void desktop.ping({
            onSuccess: (data) => prova2(data),
          })
        }
      >
        Chiama desktop
      </t>
     <div s='col'>
      <For each={prova}>{(item) => <t s="text-#009900 bg-#330000">SERVER: {item.name}</t>}</For>
      <For each={prova2}>{(item) => <t s="text-#990000 bg-#009900">DESKTOP {item.from}</t>}</For>
     </div>


    </>
  );
}
