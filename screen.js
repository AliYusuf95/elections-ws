function screenWSHandler(socket) {
  logger.debug("screen connected");

  // emit session details
  socket.emit("session", {
    sessionId: socket.sessionId,
    screenId: socket.screenId,
    code: socket.code
  });

  socket.on("chat message", msg => {
    logger.debug(msg);
  });

  socket.on("disconnect", async () => {
    logger.debug("screen disconnected");
  });
}

module.exports = {
  screenHandlerWS
};
