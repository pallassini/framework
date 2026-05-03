import Menu from "../../_components/menu";
import Closures from "./closures";
import Weekdays from "./weekdays";

export default function Calendar() {
  return (
    <div s="des:(row)">
      <div s="des:(sticky h-100)">
        <Menu />
      </div>

      <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
        <div s=" des:(w-80 mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-1) ">
          <Weekdays />
          <div s="mb-30 mt-20">
            <Closures />
          </div>
        </div>
      </div>
    </div>
  );
}
