import { desktop as desktopRpc, For, persistState, server as serverRpc, sessionState, state } from "client";
import { desktop, server } from "./signals";

export default function Home() {
	console.log(state.id(), sessionState.name(), persistState.email());

	return (
	<>
  <t
    s="text-#ffffff bg-#1a4d8c"
    click={() =>
      void serverRpc.ping.brooo({
        onSuccess: (data) => server(data),
      })
    }
  >
    Chiama server
  </t>
  <t
    s="text-#ffffff bg-#1a6b3a"
    click={() =>
      void desktopRpc.ping({
        onSuccess: (data) => desktop(data),
      })
    }
  >
    Chiama desktop
  </t>
  <For each={server}>{(item) => <t s="text-#009900 bg-#330000">{item.name}</t>}</For>
  <For each={desktop}>{(item) => <t s="text-#990000 bg-#009900">{item.fromrom}</t>}</For>
  <t s="text-#990000 bg-#009900">dfwfdwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfwfdwdw</t>
<t>dfwfwdwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfwfdwdw</t>
<t>dfwfdwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfdwfdwdw</t>
<t>dfwfdddwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfwfdwdw</t>
<t>dfddwfdwddddefefefw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfwfdwdw</t>
<t>dfwfdwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dfwfdwdw</t>
<t>dfwfdwwdw</t>
<br></br>
<br></br>
<br></br>   
<br></br>
<br></br> 
<br></br>
<br></br>   
<br></br> 
<br></br> 
<t>dddfdfdwddwdwdweddfweef</t>

	</>
	);
}
