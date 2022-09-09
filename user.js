const express = require('express');
const fs = require('fs/promises');
const unserializer = require('php-session-unserialize');
const { getLogger } = require('./logger');
const { Location, Screen, User, AdminUser } = require('./models');

const router = express.Router();

const NAMESPACE = '/users';

function wsMiddleware(io) {
  const logger = getLogger('[User-wsMiddleware]');

  return async (socket, next) => {
    try {
      if (socket.request.cookies['PHPSESSID']) {
        const data = await fs.readFile(
          '/var/cpanel/php/sessions/ea-php72/sess_' +
            socket.request.cookies['PHPSESSID'],
          'utf8'
        );
        const session = unserializer(data.trim());
        logger.debug(`cookies-session=${JSON.stringify(session)}`);
        socket.data.session = session;
        if (session.user === true) {
          socket.data.user = await User.findOne({
            attributes: ['id', 'username', 'locationId'],
            where: {
              id: session.id,
              locationId: socket.handshake.auth.locationId,
            },
          });
          socket.data.admin = true;
          logger.debug(`socket-user=${JSON.stringify(socket.data.user)}`);
        } else if (session.admin === true) {
          socket.data.user = await AdminUser.findOne({
            attributes: ['id', 'username'],
            where: {
              id: session.id,
            },
          });
          socket.data.admin = false;
          logger.debug(`socket-user=${JSON.stringify(socket.data.user)}`);
        }
      }
      if (socket.handshake.auth.locationId) {
        socket.data.locationId = socket.handshake.auth.locationId;
        socket.join(`location-${socket.data.locationId}`);
      }
      next();
    } catch (error) {
      logger.error(
        `unserialize cookies-session error={${
          (error && error.message) || JSON.stringify(error)
        }}`
      );
      next();
    }
  };
}

function wsHandler(io) {
  const logger = getLogger('[User-wsHandler]');
  const { getLocationScreens } = require('./location');
  return async (socket) => {
    if (socket.data.locationId) {
      socket.emit(
        'screens-list',
        await getLocationScreens(socket.data.locationId, io)
      );
    }

    socket.on('join-all', async () => {
      if (!socket.data.admin) {
        return;
      }
      const locations = await Location.findAll();
      for (const location of locations) {
        socket.join(`location-${location.id}`);
        const screens = await getLocationScreens(location.id, io);
        socket.emit('screens-list', {
          locationId: location.id,
          screens,
        });
      }
    });
  };
}

module.exports = {
  wsMiddleware,
  wsHandler,
  NAMESPACE,
};
