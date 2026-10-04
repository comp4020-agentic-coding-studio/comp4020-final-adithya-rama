import { defineConfig } from "vitest/config";

// Unit tests of the shared simulation and server modules. Unlike spec/, these
// need no running app.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
