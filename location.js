const express = require('express');
const { Op } = require('sequelize');
const { getLogger } = require('./logger');
const { Location, Screen, VotingResults, Candidate, SystemLog, Position} = require('./models');

const routerLogger = getLogger('[Location-router]');

function getRouter(io, sequelize) {
  const router = express.Router();

  const screensNamespace = require('./screen').NAMESPACE;
  const usersNamespace = require('./user').NAMESPACE;

  const ioScreens = io.of(screensNamespace);
  const ioUsers = io.of(usersNamespace);

  router.get('/:locationId/screens', async (req, res) => {
    const locationId = req.params.locationId;

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId,
      },
    });

    if (!location) {
      return res
        .status(404)
        .message(`Location is not exists, locationId={${locationId}}`);
    }

    routerLogger.debug(`try find location screens, locationId={${locationId}}`);
    const screens = await getLocationScreens(locationId, io);

    return res.status(200).json(screens);
  });

  router.post('/:locationId/add-screen/:code', async (req, res) => {
    const locationId = req.params.locationId;
    const code = req.params.code;
    const name = req.body.name;
    const user = req.user;

    routerLogger.debug(
      `user={${!!user}} user.isAdmin={${user.isAdmin}} user.locationId={${
        user.locationId
      }} locationId={${locationId}}`
    );
    if (!user || (!user.isAdmin && String(user.locationId) !== locationId)) {
      return res.status(403).json({ message: "You don't have permission" });
    }

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId,
      },
    });

    if (!location) {
      return res.status(404).json({
        message: `Location is not exists, locationId={${locationId}}`,
      });
    }

    routerLogger.debug(
      `try add screen to location, locationId={${locationId}} code={${code}} name={${name}}`
    );
    const screen = await Screen.findOne({
      where: {
        code: sequelize.where(sequelize.fn('LOWER', sequelize.col('code')), '=', sequelize.fn('LOWER', code)),
        locationId: null,
        connected: true,
      },
    });

    if (!screen) {
      return res.status(404).json({
        message: `Screen is not exists or not available, code={${code}}`,
      });
    }

    routerLogger.debug(
      `try to find active screen socket connection, sessionId={${screen.sessionId}}`
    );
    const socket = (await ioScreens.fetchSockets()).find(
      (s) => s.sessionId === screen.sessionId
    );

    if (!socket) {
      return res
        .status(404)
        .json({ message: `Screen is not connected, code={${code}}` });
    }

    screen.locationId = locationId;
    screen.name = name;
    await screen.save();

    await SystemLog.create({
      title: `تم إضافة شاشة التصويت (${screen.name}) في المركز (${location.name})`,
      username: user.username,
      created_at: timeFormat(new Date()),
    });

    socket.emit('attached', {
      locationName: location.name,
      screenName: screen.name,
    });
    socket.join(`location-${locationId}`);

    const screens = await getLocationScreens(locationId, io);
    ioUsers.to(`location-${locationId}`).emit('screens-list', {
      locationId: location.id,
      screens,
    });
    routerLogger.debug(socket.rooms);

    return res.status(200).json({ message: `Screen has been added` });
  });

  router.post('/:locationId/remove-screen/:screenId', async (req, res) => {
    const locationId = req.params.locationId;
    const screenId = req.params.screenId;
    const user = req.user;

    if (!user || (!user.isAdmin && String(user.locationId) !== locationId)) {
      return res.status(403).json({ message: "You don't have permission" });
    }

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId,
      },
    });

    if (!location) {
      return res.status(404).json({
        message: `Location is not exists, locationId={${locationId}}`,
      });
    }

    routerLogger.debug(
      `try find the screen, locationId={${locationId}} screenId={${screenId}}`
    );
    const screen = await Screen.findOne({
      where: {
        id: screenId,
        locationId,
        voterId: null,
      },
    });

    if (!screen) {
      return res
        .status(404)
        .json({ message: `Screen is not exists or not available` });
    }

    routerLogger.debug(`try remove screen from location`);
    const socket = (await ioScreens.fetchSockets()).find(
      (s) => s.sessionId === screen.sessionId
    );

    if (socket) {
      socket.leave(`location-${locationId}`);
      socket.emit('new-session', {
        sessionId: screen.sessionId,
        screenId,
        code: screen.code,
      });
    }

    const screenName = screen.name ? screen.name : screen.id;
    screen.locationId = null;
    screen.name = null;
    screen.connected = !!socket;
    await screen.save();

    await SystemLog.create({
      title: `تم إزالة شاشة التصويت (${screenName}) من المركز (${location.name})`,
      username: user.username,
      created_at: timeFormat(new Date()),
    });

    const screens = await getLocationScreens(locationId, io);
    ioUsers.to(`location-${locationId}`).emit('screens-list', {
      locationId: location.id,
      screens,
    });

    return res.status(200).json({ message: `Screen has been removed` });
  });

  router.post('/:locationId/show-vote/:screenId', async (req, res) => {
    const locationId = req.params.locationId;
    const screenId = req.params.screenId;
    const user = req.user;

    if (!user || (!user.isAdmin && String(user.locationId) !== locationId)) {
      return res.status(403).json({ message: "You don't have permission" });
    }

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId,
        open: true,
      },
    });

    if (!location) {
      return res.status(404).json({
        message: `Location is not exists, locationId={${locationId}}`,
      });
    }

    routerLogger.debug(
      `try find the screen, locationId={${locationId}} screenId={${screenId}}`
    );
    const screen = await Screen.findOne({
      where: {
        id: screenId,
        locationId,
        voterId: {
          [Op.not]: null,
        },
        connected: true,
      },
    });

    if (!screen) {
      return res
        .status(404)
        .json({ message: `Screen is not exists or not available` });
    }

    routerLogger.debug(`try to find screen socket`);
    const socket = (await ioScreens.fetchSockets()).find(
      (s) => s.sessionId === screen.sessionId
    );

    if (!socket) {
      return res
        .status(404)
        .json({ message: `Screen is not connected, screenId={${screenId}}` });
    }

    const data = await Candidate.findAll({
      attributes: ['id', 'name', 'img'],
      order: ['id'],
      include: [
        {
          model: Position,
          attributes: ['id', 'name', 'maxVotes', 'order'],
        },
      ]
    });
    socket.emit('show-vote', data);

    return res.status(200).json({ message: `Vote screen has requested` });
  });

  router.post('/:locationId/submit-screen/:screenId', async (req, res) => {
    const locationId = req.params.locationId;
    const screenId = req.params.screenId;
    const user = req.user;

    if (!user || (!user.isAdmin && String(user.locationId) !== locationId)) {
      return res.status(403).json({ message: "You don't have permission" });
    }

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId,
      },
    });

    if (!location) {
      return res.status(404).json({
        message: `Location is not exists, locationId={${locationId}}`,
      });
    }

    routerLogger.debug(
      `try find the screen, locationId={${locationId}} screenId={${screenId}}`
    );
    const screen = await Screen.findOne({
      where: {
        id: screenId,
        locationId,
        connected: true,
        voterId: {
          [Op.not]: null,
        },
      },
    });

    if (!screen) {
      return res
        .status(404)
        .json({ message: `Screen is not exists or not available` });
    }

    routerLogger.debug(`try to find screen socket`);
    const socket = (await ioScreens.fetchSockets()).find(
      (s) => s.sessionId === screen.sessionId
    );

    if (!socket) {
      return res
        .status(404)
        .json({ message: `Screen is not connected, screenId={${screenId}}` });
    }

    socket.emit('submit-vote');

    const screenName = screen.name ? screen.name : screen.id;
    await SystemLog.create({
      title: `تم تسليم الإستمارة في شاشة التصويت (${screenName}) في المركز (${location.name})`,
      username: user.username,
      created_at: timeFormat(new Date()),
    });

    return res.status(200).json({ message: `Screen has been submitted` });
  });

  return router;
}

async function getLocationScreens(locationId, io) {
  const screensNamespace = require('./screen').NAMESPACE;
  const ioScreens = io.of(screensNamespace);
  let screens = await Screen.findAll({
    where: {
      locationId,
    },
  });

  const sockets = (
    await ioScreens.in(`location-${locationId}`).fetchSockets()
  ).reduce((previousValue, currentValue) => {
    previousValue[currentValue.screenId] = currentValue;
    return previousValue;
  }, {});

  screens = screens.map((s) => {
    s.connected = !!sockets[s.id];
    return s;
  });

  return screens;
}

function timeFormat(date) {
  let hours = date.getHours() + 3;
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours %= 12;
  hours = (hours && (hours < 10 ? `0${hours}` : hours)) || 12;
  minutes = minutes < 10 ? `0${minutes}` : minutes;

  return `${hours}:${minutes}:${date.getSeconds()} ${ampm}`;
}

module.exports = {
  getRouter,
  getLocationScreens,
};
