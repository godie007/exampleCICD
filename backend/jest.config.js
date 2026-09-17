/**
 * Jest sobre ESM nativo: el proyecto es "type": "module", así que no hay
 * transpilación (transform: {}) y los mocks de módulos se hacen con
 * jest.unstable_mockModule + import() dinámico.
 *
 * Requiere `node --experimental-vm-modules` (ya está en el script npm test).
 */
export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js"],
  coverageDirectory: "coverage",
  verbose: true,
};
