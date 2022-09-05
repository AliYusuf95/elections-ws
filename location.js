const express = require("express");
const { getLogger } = require("./logger");
const { Location, Screen } = require("./models");
const screensNamespace = require("./screen").getNamespace();

const routerLogger = getLogger("[Location-router]");

function getRouter(io) {
  const router = express.Router();
  const ioScreens = io.of(screensNamespace);

  router.get("/:locationId/screens", async (req, res) => {
    const locationId = req.params.locationId;

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId
      }
    });

    if(!location) {
      return res.status(404).message(`Location is not exists, locationId={${locationId}}`);
    }
    
    routerLogger.debug(`try find location screens, locationId={${locationId}}`);
    let screens = await Screen.findAll({
      where: {
        locationId,
      }
    });
    
    routerLogger.debug(`try to find active screen socket connection, locationId={${locationId}}`);
    const sockets = (await ioScreens.in(`location-${locationId}`).fetchSockets()).reduce((previousValue, currentValue) => {
      previousValue[currentValue.screenId] = currentValue;
      return previousValue;
    }, {});

    screens = screens.map(s => {
      s.connected = !!sockets[s.id];
      return s;
    });

    return res.status(200).json(screens);
  });

  router.post("/:locationId/add-screen/:code", async (req, res) => {
    const locationId = req.params.locationId;
    const code = req.params.code;
    const name = req.body.name;

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId
      }
    });

    if(!location) {
      return res.status(404).json({message: `Location is not exists, locationId={${locationId}}`});
    }

    routerLogger.debug(`try add screen to location, locationId={${locationId}} code={${code}} name={${name}}`);
    const screen = await Screen.findOne({
      where: {
        code,
        locationId: null,
        connected: true,
      }
    });

    if(!screen) {
      return res.status(404).json({message: `Screen is not exists or not available, code={${code}}`});
    }

    routerLogger.debug(`try to find active screen socket connection, sessionId={${screen.sessionId}}`);
    const socket = (await ioScreens.fetchSockets()).find(s => s.sessionId === screen.sessionId);

    if(!socket) {
      return res.status(404).json({message: `Screen is not connected, code={${code}}`});
    }

    screen.locationId = locationId;
    screen.name = name;
    await screen.save();

    socket.emit('attached', {locationName: location.name, screenName: screen.name});
    socket.join(`location-${locationId}`);
    routerLogger.debug(socket.rooms);
    
    return res.status(200).json({message: `Screen has been added`});
  });

  router.post("/:locationId/remove-screen/:screenId", async (req, res) => {
    const locationId = req.params.locationId;
    const screenId = req.params.screenId;

    routerLogger.debug(`try to find location, locationId={${locationId}}`);
    const location = await Location.findOne({
      where: {
        id: locationId
      }
    });

    if(!location) {
      return res.status(404).json({message: `Location is not exists, locationId={${locationId}}`});
    }

    routerLogger.debug(`try find the screen, locationId={${locationId}} screenId={${screenId}}`);
    const screen = await Screen.findOne({
      where: {
        id: screenId,
        locationId,
      },
    });

    if(!screen) {
      return res.status(404).json({message: `Screen is not exists or not available`});
    }

    routerLogger.debug(`try remove screen from location`);
    const socket = (await ioScreens.fetchSockets()).find(s => s.sessionId === screen.sessionId);

    if (socket) {
      socket.leave(`location-${locationId}`);
      socket.emit("new-session", {
        sessionId: screen.sessionId,
        screenId,
        code: screen.code
      });
    }

    screen.locationId = null;
    screen.name = null;
    screen.connected = !!socket;
    await screen.save();

    return res.status(200).json({message: `Screen has been removed`});
  });

  return router;
}


module.exports = {
  getRouter
};
