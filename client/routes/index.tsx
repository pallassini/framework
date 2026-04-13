import { desktop, persistState, server, sessionState, state } from "client";

export default function Home() {
	console.log(state.id(), sessionState.name(), persistState.email());

	return (
	<>
  <t
    s="text-#ffffff bg-#1a4d8c"
    click={() =>
      void server.ping.brooo({
        onSuccess: (data) => console.log("[server]", data),
      })
    }
  >
    Chiama server
  </t>
  <t
    s="text-#ffffff bg-#1a6b3a"
    click={() =>
      void desktop.ping({
        onSuccess: (data) => console.log("[desktop]", data),
      })
    }
  >
    Chiama desktop
  </t>
<br></br>
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
