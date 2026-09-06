const express = require("express");
const cors = require("cors");

const serviciosRouter = require("./routes/servicios");
const contactoRouter = require("./routes/contacto");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", servicio: "Vakera API" });
});

app.use("/api/servicios", serviciosRouter);
app.use("/api/contacto", contactoRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`API de Vakera escuchando en http://localhost:${PORT}`);
});
