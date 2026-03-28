import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.js",
        "config/**/*.js",
        "api/**/*.js",
      ],
      exclude: [
        "lib/generated/**",
        "node_modules/**",
        "tests/**",
      ],
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },
  },
});
