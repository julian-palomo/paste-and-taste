import { Global, Module } from "@nestjs/common";
import { parseConfig } from "./config.schema";

// The raw variables. Tests override this provider and nothing else, so they
// build the real application with the configuration they choose.
export const ENV_SOURCE = Symbol("ENV_SOURCE");

// The validated configuration. Nest runs the factory when the module is
// compiled, so invalid variables stop the application before it serves.
export const APP_CONFIG = Symbol("APP_CONFIG");

@Global()
@Module({
  providers: [
    { provide: ENV_SOURCE, useValue: process.env },
    {
      provide: APP_CONFIG,
      inject: [ENV_SOURCE],
      useFactory: (source: Record<string, string | undefined>) => parseConfig(source),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
