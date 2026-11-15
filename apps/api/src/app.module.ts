import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "./config/config.module";
import { ProblemDetailsFilter } from "./errors/problem-details.filter";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [ConfigModule, HealthModule],
  // A provider, not app.useGlobalFilters(): the testing module gets it too.
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
