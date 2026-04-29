import Menu from "../../_components/menu";

export default function Home() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
       
            <div s="w-30 h-100 bg-#fff"></div>
            <div s="w-30 h-100 bg-#fff"></div>
            <div s="w-30 h-100 bg-#fff"></div>
         

        </div>
      </div>
    </>
  );
}
