async function test() {
  const result = await fetch("http://127.0.0.1:3434/api/files/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "local", path: "/", type: "folder", name: "test_folder_1" })
  });
  console.log(result.status, await result.text());
}
test();
