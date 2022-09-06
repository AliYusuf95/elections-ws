const express = require("express");
const http = require("http");
const fs = require("fs/promises");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const { Sequelize, QueryTypes } = require("sequelize");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const unserializer = require('php-session-unserialize');
const { getLogger, httpLoggerMiddleware } = require("./logger");
const { sessionMiddleware } = require("./sessionMiddleware");
const { MySqlSessionStore, InMemorySessionStore } = require("./sessionStore");
const { initModels, Location, Screen } = require("./models");
const { isAuthenticated, isAdmin, isAuthenticatedOrAdmin } = require("./authMiddleware");

const screenWSHandler = require("./screen").wsHandler;
const screensNamespace = require("./screen").getNamespace();
const loggerTailWSHandler = require("./logger").wsHandler;
const logsNamespace = require("./logger").getNamespace();

const logger = getLogger("index.js");

const app = express();

app.set("trust proxy", "loopback");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "https://*.googleapis.com", "https://*.bootstrapcdn.com"],
      "img-src": ["'self'", "data:", "https://*.bootstrapcdn.com"]
    },
  }
}));
app.use(cors({
  origin: [
    "https://elections-ws.memamali.com",
    "https://elections.memamali.com",
  ],
  credentials: true
}));
// for parsing application/json
app.use(bodyParser.json());
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// parse php session
app.use(async (req, res, next) => {
  try {
    if (req.cookies['PHPSESSID']) {
      const data = await fs.readFile('/var/cpanel/php/sessions/ea-php72/sess_' + req.cookies['PHPSESSID'], 'utf8');
      const session = unserializer(data.trim());
      logger.debug(`cookies-session=${JSON.stringify(session)}`);
      req.session = session;
    } 
  } catch (error) {
    logger.error(`unserialize cookies-session error={${(error && error.message) || JSON.stringify(error)}}`);
  }
  next();
});
app.use(httpLoggerMiddleware);

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

const locationRouter = require("./location").getRouter(io);

instrument(io, {
  auth: {
    type: "basic",
    username: "admin",
    password: "$2b$10$heqvAkYMez.Va6Et2uXInOnkCT6/uQj1brkrbyG3LpopDklcq7ZOS" // "changeit"
  },
  // mode: "production"
});
const ioLogs = io.of(logsNamespace);
const ioScreens = io.of(screensNamespace);

const sequelize = new Sequelize(process.env.SQL_CONNECTION_URL);

const sessionStore = new MySqlSessionStore(Screen);

ioScreens.use(sessionMiddleware(sessionStore, sequelize));

ioScreens.on("connection", screenWSHandler);

ioLogs.on("connection", loggerTailWSHandler);

app.get("/", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/location", isAuthenticated, locationRouter);

app.get("/db-ops/:type", isAdmin, async (req, res) => {
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

app.get("/log", isAdmin, (req, res) => {
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

try {
  (async () => {
    await sequelize.authenticate();
    await initModels(sequelize);
    await Screen.update({ connected: false }, { where: { connected: true } });
    server.listen(3000, () => {
      logger.info("listening on *:3000");
    });    
  })();
  logger.info("Connection has been established successfully.");
} catch (error) {
  logger.fatal("Unable to connect to the database:", error);
}
