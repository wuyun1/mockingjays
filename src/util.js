import R from 'ramda';
import Logger from './logger';

let Util = {
  logger: new Logger()
};

Util.determinePort = function (urlInfo) {
  return parseInt(urlInfo.port) || (urlInfo.protocol === 'https:' ? 443 : 80);
};


Util.stringify = function (inputObject) {
  let jsonObject = inputObject || '';

  try {
    switch (typeof (jsonObject)) {
      case 'object':
        return JSON.stringify(jsonObject, null, 2);
      case 'string':
        return jsonObject;
      case 'function':
        return '[Function]';
      default:
        return jsonObject.toString();
    }
  } catch (error) {
    Util.logger.warn('Error While Stringifying Object: ', error);
    return jsonObject.toString();
  }
};


Util.parseJSON = function (jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return jsonString;
  }
};


Util.simpleCopy = function (target) {
  return JSON.parse(JSON.stringify(target));
};


Util.regExArrayContains = function (regExArray, value) {
  let inList = function (expressionMatched, next) {
    let matchList = new RegExp(next).exec(value);
    return expressionMatched || Boolean(matchList && matchList.length > 0);
  };
  return regExArray.reduce(inList, false);
};


Util.sortObjectKeys = function (originalObject) {
  // Sort the keys to get predictable order in object keys.
  return R.map(R.toLower, R.keys(originalObject))
    .sort()
    .reduce((targetObj, key) =>
      R.assoc(key, originalObject[key], targetObj)
    , {});
};

export default Util;
