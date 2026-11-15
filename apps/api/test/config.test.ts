import { Test } from "@nestjs/testing";
import { expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ENV_SOURCE } from "../src/config/config.module";

it("refuses to start without APP_ENV, and names it", async () => {
  const compiling = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV_SOURCE)
    .useValue({})
    .compile();

  await expect(compiling).rejects.toThrow(/APP_ENV/);
});
