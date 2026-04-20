import { auth } from "client";
export default function BookerDemo() {
  return (
    <>
      <div s="mt-20vh">
        <div
          click={async () => {
            const res = await auth.register({
              email: "tesft@test.com",
              password: "test",
              username: "test",
              role: "user",
            });
            console.log(res);
          }}
        >
          Booker
        </div>
      </div>
    </>
  );
}
