"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        include: ['src/**/*.test.ts'],
        // Exclude any test file that imports 'vscode' (requires VS Code extension host)
        exclude: ['**/node_modules/**'],
        environment: 'node',
    },
});
//# sourceMappingURL=vitest.config.js.map