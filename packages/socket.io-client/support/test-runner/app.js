
/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , sio = require('socket.io')
  , path = require('path')
  , fs = require('fs');

/**
 * App.
 */

var app = express.createServer();

/**
 * Initial port to listen to.
 */

var port = 3000;

/**
 * A map of tests to socket.io ports we're listening on.
 */

var testsPorts = {};

/**
 * App configuration.
 */

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public' }))
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', {
      layout: false
    , testsPorts: testsPorts
  });
});

/**
 * Sends test files.
 */

app.get('/test/:file', function (req, res) {
  res.sendfile(path.normalize(__dirname + '/../../test/' + req.params.file));
});

/**
 * App listen.
 */

app.listen(port++, function () {
  var addr = app.address();
  console.error('   listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Override handler to simplify development
 */

function handler (req, res) {
  fs.readFile(__dirname + '/../../dist/socket.io.js', 'utf8', function (err, b) {
    if (err) {
      res.writeHead(404);
      res.end('Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(b);
  });
};

/**
 * Socket.IO default server (to serve client)
 */

var io = sio.listen(app);

io.configure(function () {
  io.set('browser client handler', handler);
});

/**
 * Scopes servers for a given test suite.
 */

var currentSuite;

function suite (name, fn) {
  currentSuite = testsPorts[name] = {};
  fn();
};

/**
 * Creates a socket io server
 */

function server (name, fn) {
  currentSuite[name] = port;
  fn(sio.listen(port));
  port++;
};

/**
 * Socket.IO servers.
 */

suite('socket.test.js', function () {

  server('test connecting the socket and disconnecting', function (io) {
    io.sockets.on('connection', function () {});
  });

  server('test receiving messages', function (io) {
    io.sockets.on('connection', function (socket) {
      var messages = 0;
      var interval = setInterval(function () {
        socket.send(++messages);

        if (messages == 3) {
          clearInterval(interval);
          socket.disconnect();
        }
      }, 50);
    });
  });

  server('test sending messages', function (io) {
    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        socket.send(msg);
      });
    });
  });

  server('test acks sent from client', function (io) {
    io.sockets.on('connection', function (socket) {
      socket.send('tobi', function () {
        socket.send('tobi 2');
      });
    });
  });

  server('test acks sent from server', function (io) {
    io.sockets.on('connection', function (socket) {});
  });

  server('test connecting to namespaces', function (io) {
    io.of('/woot').on('connection', function (socket) {
      socket.send('connected to woot');
    });

    io.of('/chat').on('connection', function (socket) {
      socket.send('connected to chat');
    });
  });

  server('test disconnecting from namespaces', function (io) {
    io.of('/a').on('connection', function (socket) {});
    io.of('/b').on('connection', function (socket) {});
  });

  server('test sending json from server', function (io) {
    io.sockets.on('connection', function (socket) {
      io.sockets.json.send(3141592);
    });
  });

  server('test sending json from client', function (io) {
    io.sockets.on('connection', function (socket) {
      socket.on('message', function (arr) {
        if (Array.isArray(arr) && arr.length == 3) {
          socket.send('echo');
        }
      });
    });
  });

  server('test emitting an event from server', function (io) {
    io.sockets.on('connection', function (socket) {
      socket.emit('woot');
    });
  });

});
