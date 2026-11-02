/**
 * Doble mínimo de `res` de Express para tests unitarios de middlewares y controllers.
 * (Misma forma que el helper inline de tests/unit.test.js, que se conserva intacto.)
 */
function crearMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

module.exports = { crearMockRes };

