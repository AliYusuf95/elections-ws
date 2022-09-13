const express = require('express');
const http = require('http');
const fs = require('fs/promises');
const { Server } = require('socket.io');
const { instrument } = require('@socket.io/admin-ui');
const { Sequelize, QueryTypes } = require('sequelize');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const unserializer = require('php-session-unserialize');
const { getLogger, httpLoggerMiddleware } = require('./logger');
const { sessionMiddleware } = require('./sessionMiddleware');
const { MySqlSessionStore } = require('./sessionStore');
const { initModels, Screen } = require('./models');
const { isUser, isAdminUser, isAuthenticated } = require('./authMiddleware');

const locationRouter = require('./location').getRouter;
const screenWSHandler = require('./screen').wsHandler;
const screensNamespace = require('./screen').NAMESPACE;
const userWSHandler = require('./user').wsHandler;
const userWSMiddleware = require('./user').wsMiddleware;
const usersNamespace = require('./user').NAMESPACE;
const loggerTailWSHandler = require('./logger').wsHandler;
const logsNamespace = require('./logger').NAMESPACE;

const logger = getLogger('index.js');

const app = express();
const ckParser = cookieParser();

app.set('trust proxy', 'loopback');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https://*.googleapis.com',
          'https://*.bootstrapcdn.com',
        ],
        'img-src': ["'self'", 'data:', 'https://*.bootstrapcdn.com'],
      },
    },
  })
);
app.use(
  cors({
    origin: [
      'https://elections-ws.memamali.com',
      'https://elections.memamali.com',
    ],
    credentials: true,
  })
);
// for parsing application/json
app.use(bodyParser.json());
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(ckParser);
// parse php session
app.use(async (req, res, next) => {
  let data = '';
  try {
    if (req.cookies['PHPSESSID']) {
      data = await fs.readFile(
        '/var/cpanel/php/sessions/ea-php72/sess_' + req.cookies['PHPSESSID'],
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
      req.session = session;
    }
  } catch (error) {
    logger.error(
      `unserialize cookies-session error={${
        (error && error.message) || JSON.stringify(error)
      }} data={${data}}`
    );
  }
  next();
});
app.use(httpLoggerMiddleware());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://elections-ws.memamali.com',
      'https://elections.memamali.com',
      'https://admin.socket.io',
    ],
    credentials: true,
  },
});

instrument(io, {
  auth: {
    type: 'basic',
    username: 'admin',
    password: '$2b$10$heqvAkYMez.Va6Et2uXInOnkCT6/uQj1brkrbyG3LpopDklcq7ZOS', // "changeit"
  },
  // mode: "production"
});
const ioLogs = io.of(logsNamespace);
const ioScreens = io.of(screensNamespace);
const ioUsers = io.of(usersNamespace);

const sequelize = new Sequelize(process.env.SQL_CONNECTION_URL);

const sessionStore = new MySqlSessionStore(Screen);

ioScreens.use(sessionMiddleware(sessionStore, sequelize));

ioScreens.on('connection', screenWSHandler(io));

ioLogs.on('connection', loggerTailWSHandler(io));

ioUsers.use((socket, next) => {
  ckParser(socket.request, null, next);
});

ioUsers.use(userWSMiddleware(io));

ioUsers.on('connection', userWSHandler(io));

app.get('/', isUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/location', isAuthenticated, locationRouter(io));

app.get('/db-ops/:type', isAdminUser, async (req, res) => {
  const type = req.params.type;
  if (!['alter', 'force'].includes(type)) {
    res.status(501).send();
    return;
  }
  await sequelize.sync({ [type]: true, match: /^memamali_elections$/ });
  const message = `All models were synchronized successfully, type={${type}}`;
  logger.info(message);
  res.set('Content-Type', 'text/plain');
  res.status(200).send(message);
});

app.get('/log', isAdminUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'logs.log'));
});

app.get('/log-tail', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'log-tail.html'));
});

app.get('*', async (req, res) => {
  const message = `It works!\n\nNodeJS ${process.version}${__dirname}\n`;
  res.set('Content-Type', 'text/plain');
  res.status(200).send(message);
  // res.redirect('/');
});

try {
  (async () => {
    await sequelize.authenticate();
    await initModels(sequelize);
    await Screen.update({ connected: false }, { where: { connected: true } });
    server.listen(3000, () => {
      logger.info('listening on *:3000');
    });
  })();
  logger.info('Connection has been established successfully.');
} catch (error) {
  logger.fatal('Unable to connect to the database:', error);
}
