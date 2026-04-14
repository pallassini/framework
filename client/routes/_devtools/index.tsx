import { desktop } from "client";
import Menu from "./_components/menu";

export default function MenuDevtools() {
	void desktop.devtools.oioi({
		onSuccess: (data) => console.log(data),
		onError: (error) => console.error(error),
	});
  
  return (
    <>
	 <Menu/>
    </>
  );
}
