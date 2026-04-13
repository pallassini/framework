import { array } from "./properties/array";
import { nullable } from "./properties/nullable";
import { optional } from "./properties/optional";
import { object } from "./properties/object";
import { boolean } from "./properties/boolean";
import { empty } from "./properties/empty";
import { literal } from "./properties/literal";
import { integer, number } from "./properties/number";
import { string } from "./properties/string";
import { unknown } from "./properties/unknown";

export const v = {
	string,
	number,
	integer,
	boolean,
	empty,
	unknown,
	literal,
	optional,
	nullable,
	array,
	object,
} as const;
