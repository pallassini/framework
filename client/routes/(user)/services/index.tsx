import Block from "client/_components/block";
import Menu from "../../_components/menu";
import Input from "client/_components/input";

export default function Services() {
  return (
    <>
      <div s="des:(row)">
     

        <div s="col centerx children-centerx w-60% des:(-ml-19) mob:(mb-30) ml-30 mt-20">
          <Block title="Outer block" s="p-20">
            <div s="col gap-3 w-100%">
              <Input placeholder="Outer input" />

              <Block title="Inner block" s="bg-#6a6a6a p-10">
                <div s="col gap-3 w-100%">
                  <Input placeholder="Inner input" />

                  <Block title="Nested inner block" s="bg-tertiary ">
                    <div s="col gap-3 w-100%">
                      <Input placeholder="Nested inner input" />
                    </div>
                  </Block>
                </div>
              </Block>
            </div>
          </Block>

        </div>
      </div>
    </>
  );
}
