import Resource from "./resources";
import OpeningHours from "./openingHours";

// If a resource has its own hours, use those; otherwise use global hours.
export default function Resources() {
  return (
    <>
      <div s="des:(-ml-6%)">
        <OpeningHours />
        <Resource />
      </div>
    </>
  );
}
