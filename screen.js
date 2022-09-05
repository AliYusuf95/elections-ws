const express = require("express");
const { getLogger } = require("./logger");
const { Location, Screen } = require("./models");

const router = express.Router();

const NAME_SPACE = "/screens";
const getNamespace = () => NAME_SPACE;

const wsLogger = getLogger("[Screen-wsHandler]");

async function wsHandler(socket) {
  wsLogger.debug("screen connected");

  // emit new-session details
  socket.emit("new-session", {
    sessionId: socket.sessionId,
    screenId: socket.screenId,
    code: socket.code
  });

  const screen = await Screen.findOne({
    where: {
      sessionId: socket.sessionId,
      id: socket.screenId
    },
    include: Location
  });

  if (screen && screen.location) {
    socket.emit("attached", {
      locationName: screen.location.name,
      screenName: screen.name,
    });
    socket.join(`location-${screen.location.id}`);
  }

  socket.on("chat message", msg => {
    wsLogger.debug(msg);
  });

  socket.on("disconnect", async () => {
    wsLogger.debug("screen disconnected");
  });
}

module.exports = {
  wsHandler,
  getNamespace,
};
