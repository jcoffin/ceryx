var exports = module.exports = {};

/**
 * A ConnectionContext object manages state for a connection and
 * provides helper functions to message handlers.
 */
class ConnectionContext {
  /**
   * Create a ConnectionContext object.
   * @param {object} logger
   * @param {RedisService} redis - redis service to handle subscriptions
   * @param {object} ws - web socket object
   * @param {function} getRedisChannels - function used to get the Redis channels
   */
  constructor(logger, redis, ws, getRedisChannels) {
    this.logger = logger;
    this.redis = redis;
    this.ws = ws;
    this.getRedisChannels = getRedisChannels;
    this.redisChannels = [];
  }

  /**
   * Sent a message to the client.
   * @param {string} message - the message
   */
  send(message) {
    this.ws.send(message, (error) => {
      if (error) {
        this.logger.warn('Connection ID - %s - error sending message: %s - error is: %s',
                         this.id, message, error);        
      } else {
        this.logger.debug('Connection ID - %s - message sent to client: %s', this.id, message);        
      }
    });
  }

  /**
   * Send an event to the client. An event has a 'name' and
   * 'data'. The message data will be turned into a JSON string.
   * @param {string} name - the message name
   * @param {object} data - the message payload
   */
  sendEvent(name, data) {
    this.send(JSON.stringify([name, data]));
  }

  /**
   * Decode a token, set the userId and subscribe to Redis channel. If
   * token is valid of course.
   * @param {string} token - the auth token
   */
  authenticate(token) {
    let userId = this.decodeToken(token);
    if (userId) {
      this.userId = userId;
      this.logger.info('Connection ID - %s - decoded token and set userId to: %s', this.id, userId);
      this.redisSub.subscribe(userId, this.getRedisMessageHandler());
      this.logger.info('Connection ID - %s - subscribed to Redis channel', this.id);      
      this.sendEvent('user-authenticated', userId);
    } else {
      this.sendEvent('authentication-failed', {token: token});
      this.logger.warn('Connection ID - %s - failed authentication attempt with token: %s', this.id, token);      
    }
  }

  /**
   * Save an object to Redis. The object will be turned into a JSON
   * string.
   * @param {string} event - event name
   * @param {object} data - event data
   */
  saveEvent(name, data) {
    let event = JSON.stringify({name: name,
                                src: 'hermes',
                                timestamp: new Date(),
                                data: data});
    this.redisStore.save(event);
    this.logger.info('Connection ID - %s - event saved: %s', this.id, event);
    this.sendEvent('event-saved');
  }

  /**
   * Process an event received from the websocket.
   * @param {object} event
   */
  processEvent(event) {
    if (event[0] === 'authenticate') {
      this.authenticate(event[1]);
    } else if (this.userId) {
      this.saveEvent(event[0], event[1]);      
    } else {
      this.logger.warn('Connection ID - %s - unauthenticated event received', this.id, event);
      this.sendEvent('unauthenticated-message-received', event);            
    }
  }

  /**
   * Create a generic websocket onClose handler.
   */
  getOnCloseHandler() {
    return (closeEvent) => {
      this.logger.debug('Connection ID - %s - closing connection', this.id);
      this.redisStore.close();
      this.redisSub.close();
      this.logger.info('Connection ID - %s - connection closed', this.id);
    };
  }

  /**
   * Create a generic websocket error handler.
   */
  getOnErrorHandler() {
    return (error) => {
      this.logger.error('Connection ID - %s - error occured', this.id, error);
    };
  }

  /**
   * Create a message handler to deal with incoming Redis
   * messages.
   */
  getRedisMessageHandler() {
    return (message) => {
      this.logger.debug('Connection ID - %s - Redis message received: %s', this.id, message);
      this.send(message);
    };
  }
  
  /**
   * Create a message handler to deal with incoming websocket
   * messages.
   */
  getMessageHandler() {
    return (message) => {
      let event;
      this.logger.info('Connection ID - %s - received message: %s', this.id, message);
      try {
        event = JSON.parse(message);
      }
      catch (SyntaxError) {
        this.logger.warn('Connection ID - %s - invalid JSON received: %s', this.id, message);
        this.sendEvent('unable-to-parse-json-error', message);
        return;
      }
      this.processEvent(event);
    };
  }
}

/**
 * Create a connection handler callback.
 * @param {object} logger - logger object
 * @param {object} redisConfig - Redis configuration
 * @param {string} secret - JWT shared secret
 */
// let createConnectionHandler = function(logger, redisConfig, secret) {
//   return function(ws) {
//     let connId = uuidV4();
//     let decoderFn = createTokenDecoder(secret);
//     let redisStore = new RedisService(redisConfig);
//     let redisSub = new RedisService(redisConfig);
//     let context = new ConnectionContext(logger, redisStore, redisSub, ws, decoderFn, connId);
//     ws.on('error', context.getOnErrorHandler());
//     ws.on('close', context.getOnCloseHandler());
//     ws.on('message', context.getMessageHandler());
//     logger.info('Connection established with ID: %s', connId);
//   };
// };

// exports.createTokenDecoder = createTokenDecoder;
// exports.ConnectionContext = ConnectionContext;
// exports.createConnectionHandler = createConnectionHandler;
