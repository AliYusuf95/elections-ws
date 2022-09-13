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
    let data = '';
    try {
      if (socket.request.cookies['PHPSESSID']) {
        data = await fs.readFile(
          '/var/cpanel/php/sessions/ea-php72/sess_' +
            socket.request.cookies['PHPSESSID'],
          'utf8'
        );
        const dataSplit = data.split('|');
        if (dataSplit.findIndex((s) => s === 'csrf-lib') >= 0) {
          const crf = dataSplit.findIndex((s) => s === 'csrf-lib');
          if (crf + 2 !== dataSplit.length) {
            const crfData = dataSplit[crf + 1].split(';');
            dataSplit[crf + 1] = crfData[crfData.length - 1];
            dataSplit.splice(crf, 1);
          } else {
            dataSplit.splice(crf, 2);
          }
        } else if (dataSplit.findIndex((s) => s.endsWith('csrf-lib')) >= 0) {
          const crf = dataSplit.findIndex((s) => s.endsWith('csrf-lib'));
          let remain = dataSplit[crf].split(';');
          remain.splice(remain.length - 1, 1);
          remain = remain.join(';') + ';';
          dataSplit[crf] = remain;
          dataSplit.splice(crf + 1, 1);
        }
        data = dataSplit.join('|');
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
        }} data={${data}}`
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
      const screens = await getLocationScreens(socket.data.locationId, io);
      socket.emit('screens-list', {
        locationId: socket.data.locationId,
        screens,
      });
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
