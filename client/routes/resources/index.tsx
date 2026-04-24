import Block from "../../_components/block";
import Menu from "../_components/menu";

export default function Resources() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <div s="row des:(w-100%)">
            <Block s="des:(w-70% mt-30) mob:(w-96% mt-20)" title="Users" icon="users"><t>ciao</t></Block>
            <Block s="des:(w-70% mt-30) mob:(w-96% mt-20)" title="Users" icon="users"></Block>
          </div>
        </div>
      </div>
    </>
  );
}
