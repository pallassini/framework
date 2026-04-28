import Calendar from "./_components/calendar";
import Menu from "./_components/menu";

export default function Home() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <Calendar />
        </div>
      </div>
    </>
  );
}
