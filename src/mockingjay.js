/**
 * Core that determines wether to fetch a fresh copy from the source or
 * fetch a cached copy of the data.
 */
var Color = require('./colorize');
var CacheClient = require('./cache_client');
var HttpClient = require('./http_client');
var HeaderUtil = require('./header_util');
var Logger = require('./logger');
var Util = require('./util');
var url = require('url');

var logger = new Logger();

var Mockingjay = function(options) {
  this.options = options;
  this.options.logger = logger;
  logger.setLevel(options.logLevel);

  this.cacheClient = new CacheClient(options);
  this.httpClient = new HttpClient(options);
}

/**
 * Determine if we have request cached.
 */
Mockingjay.prototype.knows = function(request) {
  return this.cacheClient.isCached(request);
};

/**
 * Fetch a Request form cache.
 */
Mockingjay.prototype.repeat = function(request) {
  logger.info(Color.yellow('Repeating'), JSON.stringify(request));
  return this.cacheClient.fetch(request);
};

/**
 * Fetch a Request form the Source.
 */
Mockingjay.prototype.learnOrPipe = function(request, outputBuffer) {
  logger.info(Color.red('Learning'), JSON.stringify(request));
  var self = this;
  var responsePromise = this.httpClient.fetch(request, outputBuffer);
  return responsePromise.then(function (response) {
    if (self._okToCache(response.headers['content-type'])) {
      return self.cacheClient.record(request, response);
    } else {
      return Promise.resolve(response);
    }
  }, function (error) {
    return Promise.reject(error);
  });
};


Mockingjay.prototype._okToCache = function (responseType) {
  // Ok to Cache when the Response Type is not in the ignore list.
  return !Util.regExArrayContains(this.options.ignoreContentType, responseType);
};


/**
 * Function that echos the response back to the client.
 * Within this function we determine if we need to learn
 * or need to fetch a fresh response.
 */
Mockingjay.prototype.echo = function(request, outputBuffer) {
  var self = this;
  var shouldRepeat = this.knows(request) && !this.options.refresh;
  var responsePromise = shouldRepeat ? this.repeat(request) : this.learnOrPipe(request, outputBuffer);
  responsePromise.then(function(response) {
    logger.info('Responding:', response.status, response.type);
    if (!response.piped) {
      var responseString = typeof(response.data) === 'string' ? response.data : Util.stringify(response.data);
      if (HeaderUtil.isText(response.type)) {
        logger.info(responseString);
      }
      outputBuffer.writeHead(response.status, {'Content-Type': response.type});
      outputBuffer.end(responseString);
    }
  }, function (error) {
    logger.error(error.toString());
    outputBuffer.writeHead(500, {'Content-Type': 'text/plain'});
    outputBuffer.end('Network Error Occurred while Contacting Source Server');
  });
};

/**
 * Callback that is called when the server recieves a request.
 */
Mockingjay.prototype.onRequest = function(request, response) {
  logger.info(Color.green('Request Recieved'), request.url, request.method);

  var self = this;
  var simplifiedRequest = this.simplify(request);
  var corsHeaders = HeaderUtil.getCorsHeaders();

  for (var corsHeader in corsHeaders) {
    response.setHeader(corsHeader, corsHeaders[corsHeader]);
  }

  request.on('data', function(data) {
    simplifiedRequest.body += data;
  });

  request.on('end', function() {
    self.echo(simplifiedRequest, response);
  });
};


Mockingjay.prototype.simplify = function (req) {
  var self = this;
  var urlSplit = url.parse(this.options.serverBaseUrl + req.url);
  var isHttps = urlSplit.protocol === 'https:'
  var options = {
    hostname: urlSplit.hostname,
    port: parseInt(urlSplit.port) || (isHttps ? 443 : 80),
    path: urlSplit.path,
    body: '',
    method: req.method,
    headers: HeaderUtil.standardize(req.headers)
  };
  return options;
};

module.exports = Mockingjay
