// url_test.ts
import { assertEquals } from "https://deno.land/std@0.202.0/assert/mod.ts";
import { isLocalPathOrURL } from "../load.ts";
Deno.test("url test", () => {
  const url = new URL("./foo.js", "https://deno.land/");
  assertEquals(url.href, "https://deno.land/foo.js");
});

Deno.test("isLocalPathOrURL test", () => {
  assertEquals(isLocalPathOrURL("/home/test.txt"), true);
});
