const express = require('express');
const { getLogger } = require('./logger');
const { Location, Screen, Candidate } = require('./models');

const router = express.Router();

const NAMESPACE = '/screens';

function wsHandler(io) {
  const logger = getLogger('[Screen-wsHandler]');
  const { getLocationScreens } = require('./location');
  const usersNamespace = require('./user').NAMESPACE;

  const ioUsers = io.of(usersNamespace);
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

      // notify users
      const screens = await getLocationScreens(screen.location.id, io);
      ioUsers.to(`location-${screen.location.id}`).emit('screens-list', {
        locationId: screen.location.id,
        screens,
      });

      if (screen.voterId) {
        const data = await Candidate.findAll({
          attributes: ['id', 'name', 'img'],
          order: ['name'],
        });
        socket.emit('show-vote', data);
      }
    }

    socket.on('chat message', (msg) => {
      logger.debug(msg);
    });

    socket.on('disconnect', async () => {
      // notify users
      if (screen.location.id) {
        const screens = await getLocationScreens(screen.location.id, io);
        ioUsers.to(`location-${screen.location.id}`).emit('screens-list', {
          locationId: screen.location.id,
          screens,
        });
      }
      logger.debug('screen disconnected');
    });
  };
}

module.exports = {
  wsHandler,
  NAMESPACE,
};
