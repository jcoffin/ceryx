const core = require('../src/core.js');

describe("connectionContext", function() {
  let context, redis, ws, logger, msgHandler;

  let tokenFn = function(token) {
    return (token === 'password') ? 'userId' : false;
  };
  
  beforeEach(function() {
    redis = jasmine.createSpyObj('redisService', ['subscribe']);
    ws = jasmine.createSpyObj('websocket', ['send']);
    logger = jasmine.createSpyObj('logger', ['info', 'warn', 'debug']);
    context = new core.ConnectionContext(logger, redisStore, redisSub, ws, tokenFn, 'conn-id');
    handler = context.getMessageHandler();
  });

  xit("logs an error when unable to parse the msg into JSON", function() {
    handler('foo');
    expect(logger.warn).toHaveBeenCalled();
  });

  xit("returns an error when unable to parse the msg into JSON", function() {
    let errorResponse = JSON.stringify(['unable-to-parse-json-error', 'foo']);
    handler('foo');
    expect(ws.send).toHaveBeenCalledWith(errorResponse, jasmine.any(Function));
  });

  xit("sends an unauthorized response if unauthenticated", function() {
    let errorResponse = JSON.stringify(['unauthenticated-message-received', ['foo', 'bar']]);
    handler(JSON.stringify(['foo', 'bar']));
    expect(ws.send).toHaveBeenCalledWith(errorResponse, jasmine.any(Function));
  });

  xit("saves an event if authenticated", function() {
    let arg;
    let message = JSON.stringify(['book-viewed', 'book-id']);
    context.authenticate('password');
    handler(message);
    arg = JSON.parse(redisStore.save.calls.mostRecent().args[0]);
    expect(arg.name).toBe('book-viewed');
    expect(arg.src).toBe('hermes');
    expect(arg.timestamp).toBeTruthy();
    expect(arg.data).toBe('book-id');
  });

  xit("sends a success event if message is saved", function() {
    let message = JSON.stringify(['book-viewed', 'book-id']);
    let success = JSON.stringify(['event-saved', null]);
    context.authenticate('password');
    handler(message);
    expect(ws.send.calls.mostRecent().args[0]).toEqual(success);
  });

  xit("sends a success message when decoding a token", function() {
    let message = JSON.stringify(['authenticate', 'password']);
    let success = JSON.stringify(['user-authenticated', 'userId']);
    handler(message);
    expect(ws.send).toHaveBeenCalledWith(success, jasmine.any(Function));
  });

  xit("sets the userId when decoding a token", function() {
    let message = JSON.stringify(['authenticate', 'password']);
    handler(message);
    expect(context.userId).toBe('userId');
  });

  xit("subscribes to the user Redis channel when decoding a token", function() {
    context.authenticate('password');
    expect(redisSub.subscribe).toHaveBeenCalled();
  });

  xit("sends a unsuccessful message when decoding fails", function() {
    let message = JSON.stringify(['authenticate', 'foo']);
    let error = JSON.stringify(['authentication-failed', {token: 'foo'}]);
    handler(message);
    expect(ws.send).toHaveBeenCalledWith(error, jasmine.any(Function));
  });

  xit("sends messages from the Redis channel to the client", function() {
    let message = JSON.stringify({'foo':'bar'});
    context.getRedisMessageHandler()(message);
    expect(ws.send).toHaveBeenCalledWith(message);
  });
});
