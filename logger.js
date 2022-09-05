const log4js = require("log4js");
const { Tail } = require("tail");
const path = require("path");
const morgan = require("morgan");
const fs = require("fs");

// WS namespace
const NAME_SPACE = "/logs";
const getNamespace = () => NAME_SPACE;

const MAX_BUFFER = 20000;
const LOG_FILE_NAME = "logs.log";
const LOG_FILE_PATH = path.join(__dirname, LOG_FILE_NAME);
const getLogger = log4js.getLogger;
const logSockets = new Map();

log4js.configure({
  appenders: { everything: { type: "file", filename: LOG_FILE_PATH } },
  categories: { default: { appenders: ["everything"], level: "ALL" } }
});

const httpLogger = getLogger("[HTTP]");
const logFormat = ":remote-addr - \":method :url HTTP/:http-version\" :status :res[content-length] \":user-agent\"";
const logMapper = (str) => str.replace("\n", "");

const httpLoggerMiddleware = [
  morgan(logFormat, {
    stream: {
      write: (str) => httpLogger.info(logMapper(str))
    },
    skip: (req, res) => res.statusCode >= 400
  }), 
  morgan(logFormat, {
    stream: {
      write: (str) => httpLogger.warn(logMapper(str))
    },
    skip: (req, res) => res.statusCode < 400 || res.statusCode >= 500
  }), 
  morgan(logFormat, {
    stream: {
      write: (str) => httpLogger.error(logMapper(str))
    },
    skip: (req, res) => res.statusCode < 500
  })
];


const tailLogger = getLogger("[Logger-Tail]");
const logTail = new Tail(LOG_FILE_PATH, {
  fromBeginning: false
});
logTail.unwatch();
logTail.on("line", data => {
  logSockets.forEach((socket, key) => {
    socket.emit("continuousTextData", {
      text: (Array.isArray(data) ? data : [data]).map(e => `${e}\n`)
    });
  });
});

logTail.on("error", function(error) {
  tailLogger.error(
    `logTail error={${(error && error.message) || JSON.stringify(error)}}`
  );
});

const wsLogger = getLogger("[Logger-wsHandler]");
async function wsHandler(socket) {
  socket.on("openFile", data => {
    fs.stat(LOG_FILE_PATH, function(err, stat) {
      if (err) {
        socket.emit("error", err.toString());
        return;
      }
      const start = stat.size > MAX_BUFFER ? stat.size - MAX_BUFFER : 0;
      const stream = fs.createReadStream(LOG_FILE_PATH, {
        start: start,
        end: stat.size
      });
      stream.addListener("error", function(err) {
        socket.emit("error", err.toString());
      });
      stream.addListener("data", function(filedata) {
        filedata = filedata.toString("utf-8");
        let lines;
        if (filedata.length >= MAX_BUFFER) {
          lines = filedata.slice(filedata.indexOf("\n") + 1).split("\n");
        } else {
          lines = filedata.split("\n");
        }
        socket.emit("initialTextData", {
          text: lines,
          filename: LOG_FILE_NAME
        });
        if (!logSockets.has(socket.id)) {
          logSockets.set(socket.id, socket);
          if (logSockets.size === 1) {
            logTail.watch(logTail.latestPosition());
            wsLogger.debug(`start watching log file`);
          }
          wsLogger.debug(`started log watching for sessionId={${socket.id}}`);
        }
      });
    });
  });

  socket.on("disconnect", async () => {
    wsLogger.debug(`stop log watching for sessionId={${socket.id}}`);
    logSockets.delete(socket.id);
    if (logSockets.size < 1) {
      wsLogger.debug(`no log connection - stop watching log file`);
      logTail.unwatch();
    }
  });
}

module.exports = {
  getLogger,
  wsHandler,
  httpLoggerMiddleware,
  getNamespace,
};
