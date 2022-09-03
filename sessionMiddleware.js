const crypto = require("crypto");
const { getLogger } = require("./logger");

const randomId = () => crypto.randomBytes(8).toString("hex");

const logger = getLogger("sessionMiddleware");

function sessionMiddleware(sessionStore) {
  return async (socket, next) => {
    socket.on("disconnect", async () => {
      await sessionStore.deleteSession(socket.sessionId);
    });

    const sessionId = socket.handshake.auth.sessionId;
    if (sessionId) {
      const session = await sessionStore.findSession(sessionId);
      if (session) {
        socket.sessionId = sessionId;
        socket.screenId = session.screenId;
        return next();
      }
    }
    socket.sessionId = randomId();
    const session = await sessionStore.saveSession(socket.sessionId, {
      connected: true
    });
    logger.debug(`new session id={${session.id}}`);
    socket.screenId = session.id;
    next();
  };
}

module.exports = {
  sessionMiddleware
};
