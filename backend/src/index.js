const cluster = require("cluster");
const os = require("os");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const apiRoutes = require("./routes/api");

const PORT = process.env.PORT || 4000;

// /api/recommend y /api/team-check son cómputo síncrono de CPU (sin I/O), así que
// bajo carga concurrente se encolan todos en el mismo hilo del proceso y la latencia
// se dispara. Con cluster, cada request cae en uno de varios procesos worker (uno por
// núcleo), cada uno con su propio event loop, así se reparten entre núcleos en vez de
// competir por uno solo. La app no tiene estado compartido entre requests (todo sale
// de heroes.json/maps.json en memoria), así que no hace falta session affinity.
const numWorkers = Number(process.env.WEB_CONCURRENCY) || os.cpus().length;

function startServer() {
  const app = express();

  app.use(compression());
  app.use(cors());
  app.use(express.json());

  app.use("/api", apiRoutes);

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.listen(PORT, () => {
    console.log(`OW2 Advisor backend escuchando en puerto ${PORT} (worker ${process.pid})`);
  });
}

if (cluster.isPrimary && numWorkers > 1) {
  console.log(`Primary ${process.pid}: levantando ${numWorkers} workers`);
  for (let i = 0; i < numWorkers; i++) cluster.fork();

  cluster.on("exit", (worker, code) => {
    console.log(`Worker ${worker.process.pid} murió (code ${code}), reiniciando`);
    cluster.fork();
  });
} else {
  startServer();
}
