const log4js = require("log4js");
const { Tail } = require("tail");
const path = require("path");
const fs = require("fs");

const MAX_BUFFER = 20000;
const LOG_FILE_NAME = "logs.log";
const LOG_FILE_PATH = path.join(__dirname, LOG_FILE_NAME);
const getLogger = log4js.getLogger;
const logSockets = new Map();
const logger = getLogger("watchLogger");

log4js.configure({
  appenders: { everything: { type: "file", filename: LOG_FILE_PATH } },
  categories: { default: { appenders: ["everything"], level: "ALL" } }
});

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
  logger.error(
    `logTail error={${(error && error.message) || JSON.stringify(error)}}`
  );
});

function loggerTailWSHandler(socket) {
  socket.on("openFile", data => {
    fs.stat(LOG_FILE_PATH, function(err, stat) {
      if (err) {
        console.log(err);
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
            logger.debug(`start watching log file`);
          }
          logger.debug(`started log watching for sessionId={${socket.id}}`);
        }
      });
    });
  });

  socket.on("disconnect", async () => {
    logger.debug(`stop log watching for sessionId={${socket.id}}`);
    logSockets.delete(socket.id);
    if (logSockets.size < 1) {
      logger.debug(`no log connection - stop watching log file`);
      logTail.unwatch();
    }
  });
}

module.exports = {
  getLogger,
  loggerTailWSHandler
};
