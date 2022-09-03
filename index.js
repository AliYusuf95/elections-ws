const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const { Sequelize, QueryTypes } = require("sequelize");
const path = require("path");
const bodyParser = require('body-parser');
const { getLogger, loggerTailWSHandler } = require("./logger");
const { sessionMiddleware } = require("./sessionMiddleware");
const { MySqlSessionStore, InMemorySessionStore } = require("./sessionStore");
const { initModels, Location, Screen } = require("./models");

const logger = getLogger("index.js");

const app = express();

// for parsing application/json
app.use(bodyParser.json());
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://elections-ws.memamali.com",
      "https://elections.memamali.com",
      "https://admin.socket.io"
    ],
    credentials: true
  }
});

instrument(io, {
  auth: {
    type: "basic",
    username: "admin",
    password: "$2b$10$heqvAkYMez.Va6Et2uXInOnkCT6/uQj1brkrbyG3LpopDklcq7ZOS" // "changeit"
  },
  // mode: "production"
});
const logsNamespace = io.of("/logs");
const screensNamespace = io.of("/screens");

const sequelize = new Sequelize(process.env.SQL_CONNECTION_URL);

try {
  (async () => {
    await sequelize.authenticate();
    await initModels(sequelize);
    await Screen.update({ connected: false }, { where: { connected: true } });
  })();
  logger.info("Connection has been established successfully.");
} catch (error) {
  logger.fatal("Unable to connect to the database:", error);
}

const sessionStore = new MySqlSessionStore(Screen);

screensNamespace.use(sessionMiddleware(sessionStore, sequelize));

screensNamespace.on("connection", async socket => {
  logger.debug("screen connected");

  // emit session details
  socket.emit("session", {
    sessionId: socket.sessionId,
    screenId: socket.screenId,
    code: socket.code
  });

  socket.on("chat message", msg => {
    logger.debug(msg);
  });

  socket.on("disconnect", async () => {
    logger.debug("screen disconnected");
  });
});

logsNamespace.on("connection", loggerTailWSHandler);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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

app.post("/locations/:locationId/add-screen/:code", async (req, res) => {
  const locationId = req.params.locationId;
  const code = req.params.code;
  const name = req.body.name;

  logger.debug(`try to find location, locationId={${locationId}}`);
  const location = await Location.findOne({
    where: {
      id: locationId
    }
  });

  if(!location) {
    return res.status(403).json({message: `Location is not exists, locationId={${locationId}}`});
  }

  logger.debug(`try add screen to location, locationId={${locationId}} code={${code}} name={${name}}`);
  const screen = await Screen.findOne({
    where: {
      code,
      location: null,
      connected: true,
    },
  });

  if(!screen) {
    return res.status(403).json({message: `Screen is not exists or not available, code={${code}}`});
  }

  screen.location = locationId;
  screen.name = name;
  await screen.save();

  const sockets = await io.of("/screens").fetchSockets();
  const screenSocket = sockets.find(s => s.sessionId == screen.sessionId);
  logger.debug(`update screen connection ${!!screenSocket}, ${screen.sessionId}, ${sockets.length}`);
  if(screenSocket) {
    screenSocket.emit({locationId, name});
  }
  
  return res.status(200).json({message: `Screen has been updated`});
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
