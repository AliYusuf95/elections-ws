const express = require('express');
const { getLogger } = require('./logger');
const { Location, Screen } = require('./models');

const router = express.Router();

const NAMESPACE = '/screens';

function wsHandler(io) {
  const logger = getLogger('[Screen-wsHandler]');
  return async (socket) => {
    logger.debug('screen connected');

    // emit new-session details
    socket.emit('new-session', {
      sessionId: socket.sessionId,
      screenId: socket.screenId,
      code: socket.code,
    });

    const screen = await Screen.findOne({
      where: {
        sessionId: socket.sessionId,
        id: socket.screenId,
      },
      include: Location,
    });

    if (screen && screen.location) {
      socket.emit('attached', {
        locationName: screen.location.name,
        screenName: screen.name,
      });
      socket.join(`location-${screen.location.id}`);
    }

    socket.on('chat message', (msg) => {
      logger.debug(msg);
    });

    socket.on('disconnect', async () => {
      logger.debug('screen disconnected');
    });
  };
}

module.exports = {
  wsHandler,
  NAMESPACE,
};
