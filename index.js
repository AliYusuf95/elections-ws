const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { Sequelize, QueryTypes, DataTypes, Deferrable } = require("sequelize");
const path = require("path");
const { getLogger, watchLogger } = require("./logger");
const { sessionMiddleware } = require("./sessionMiddleware");
const { RedisSessionStore, InMemorySessionStore } = require("./sessionStore");
const { initModels, Location, Screen } = require("./models");

const logger = getLogger("index.js");

const io = new Server(server, {
  cors: {
    origin: [
      "https://elections-ws.memamali.com",
      "https://elections.memamali.com"
    ],
    credentials: true
  }
});
const logsNamespace = io.of("/logs");
const screensNamespace = io.of("/screens");

const sequelize = new Sequelize(process.env.SQL_CONNECTION_URL);

try {
  (async () => {
    await sequelize.authenticate();
    await initModels(sequelize);
  })();
  logger.info("Connection has been established successfully.");
} catch (error) {
  logger.fatal("Unable to connect to the database:", error);
}

const sessionStore = new InMemorySessionStore(Screen);

screensNamespace.use(sessionMiddleware(sessionStore));

screensNamespace.on("connection", async socket => {
  logger.debug("screen connected");

  // emit session details
  socket.emit("session", {
    sessionId: socket.sessionId,
    screenId: socket.screenId
  });

  socket.on("chat message", msg => {
    logger.debug(msg);
    io.emit("chat message", msg);
  });

  socket.on("disconnect", async () => {
    logger.debug("screen disconnected");
  });
});

logsNamespace.on("connection", watchLogger);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, __dirname, "public", "index.html"));
});

app.get("/db-ops/:type", async (req, res) => {
  const type = req.params.type;
  if (!["alter", "force"].includes(type)) {
    res.status(501).send();
    return;
  }
  await sequelize.sync({ [type]: true, match: /^memamali_elections$/ });
  const message = `All models were synchronized successfully, type={${type}}`;
  logger.info(message);
  res.set("Content-Type", "text/plain");
  res.status(200).send(message);
});

app.get("/log", (req, res) => {
  res.sendFile(path.join(__dirname, "logs.log"));
});

app.get("/log-tail", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "log-tail.html"));
});

app.get("*", async (req, res) => {
  const message = `It works!\n\nNodeJS ${process.version}${__dirname}\n`;
  res.set("Content-Type", "text/plain");
  res.status(200).send(message);
  // res.redirect('/');
});

server.listen(3000, () => {
  logger.info("listening on *:3000");
});
