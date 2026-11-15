import { Controller, Get, Inject } from "@nestjs/common";
import { APP_CONFIG } from "../config/config.module";
import type { AppConfig } from "../config/config.schema";

// Checks nothing else yet: each dependency adds its own check when it arrives.
@Controller("health")
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  check() {
    return { status: "ok", environment: this.config.APP_ENV };
  }
}
