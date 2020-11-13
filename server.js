const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const apiRouter = require("./src/api/api.router");
require("./src/utils/db.connect");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());
app.use("/api/v1", apiRouter);

app.get("/", (req, res) => {
  res.send("Welcome to Twitter Helpdesk API Server!");
});

app.listen(PORT, () => {
  console.log(`Twitter Helpdesk API Server is running on ${PORT}`);
});

const Twit = require("twit");
const webSocketsServerPort = 8000;
const webSocketServer = require("websocket").server;
const http = require("http");
const server = http.createServer();
server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
  httpServer: server,
  cors: false,
});

// Generates unique ID for every new connection
const getUniqueID = () => {
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return s4() + s4() + "-" + s4();
};

const clients = {};

wsServer.on("request", function (request) {
  const path = request && request.resourceURL && request.resourceURL.path;
  const tempArr = path && path.substr(1, path.length).split("&");
  const dataArray =
    tempArr && tempArr.map((item) => item && item.split("=")[1]);
  const oauth_token = dataArray[0];
  const oauth_token_secret = dataArray[1];
  const screen_name = dataArray[2];

  const userID = getUniqueID();
  console.log(
    new Date() + ` Recieved a new connection from origin ${request.origin}.`
  );

  const connection = request.accept(null, request.origin);
  clients[userID] = {
    connection,
    oauth_token,
    oauth_token_secret,
    screen_name,
  };
  console.log(`Connected: ${userID} in ${Object.getOwnPropertyNames(clients)}`);

  for (const client of Object.keys(clients)) {
    const { oauth_token, oauth_token_secret } = clients[client];
    if (
      !oauth_token ||
      oauth_token === "undefined" ||
      !oauth_token_secret ||
      oauth_token_secret === "undefined"
    ) {
      continue;
    }
    const T = new Twit({
      consumer_key: "ywkvzrkLoWlJBDu1yYvBOgywg",
      consumer_secret: "IPkHRKPkxx35K5Xgjf5173oHdJRaUyjZEf1xAocmPVhRsvwBNA",
      access_token: oauth_token,
      access_token_secret: oauth_token_secret,
      timeout_ms: 60 * 1000,
      strictSSL: true,
    });

    const stream = T.stream("statuses/filter", {
      track: `@${clients[client].screen_name}`,
    });

    stream &&
      stream.on("tweet", function (tweet) {
        //   console.log("tweet", tweet);
        clients[client] &&
          clients[client].connection.sendUTF(
            JSON.stringify({ type: "NEW_TWEET", data: tweet })
          );
      });
  }

  connection.on("close", function (connection) {
    console.log(`${new Date()} Peer ${userID} disconnected`);
    delete clients[userID];
  });
});

app.all("*", (req, res) => {
  sendErrorProd(
    new AppError(`Can't find ${req.originalUrl} on this server!`, 404),
    res
  );
});

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log("UNHANDLED REJECTION! Shutting down...");
  process.exit(1);
});
