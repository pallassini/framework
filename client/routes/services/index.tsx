import { state } from "client";
import { Form } from "../../../core/client/form";
import { For } from "../../../core/client/runtime/tag";
import { server } from "../../../core/client/server";
import { v } from "../../../core/client/validator";
import Input from "../../_components/input";
import Popmenu from "../../_components/popmenu";
import Menu from "../_components/menu";
import Block from "../../_components/block";
import Categories from "./_components/groups";

export default function Services() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <Categories />
        </div>
      </div>
    </>
  );
}
